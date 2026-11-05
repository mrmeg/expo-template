//! Local benchmark only: pinned test key, read-only fixture DB, no production integrations.
use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

struct AppState {
    db: Mutex<Connection>,
    key: DecodingKey,
    validation: Validation,
}

#[derive(Clone, Deserialize)]
struct Claims {
    sub: String,
}

#[derive(Deserialize)]
struct Page {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Serialize)]
struct Item {
    id: i64,
    title: String,
    body: String,
}

#[derive(Serialize)]
struct Items {
    user_id: String,
    items: Vec<Item>,
}

fn error(status: StatusCode, message: &'static str) -> Response {
    (
        status,
        [("content-type", "application/json")],
        format!("{{\"error\":\"{message}\"}}"),
    )
        .into_response()
}

async fn items(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    query: Result<Query<Page>, axum::extract::rejection::QueryRejection>,
) -> Response {
    let unauthorized = || error(StatusCode::UNAUTHORIZED, "unauthorized");
    let Some(token) = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    else {
        return unauthorized();
    };
    let Ok(header) = decode_header(token) else {
        return unauthorized();
    };
    if header.alg != Algorithm::RS256 || header.kid.as_deref() != Some("bench-key") {
        return unauthorized();
    }
    let Ok(verified) = decode::<Claims>(token, &state.key, &state.validation) else {
        return unauthorized();
    };
    if verified.claims.sub.is_empty() {
        return unauthorized();
    }
    let Ok(Query(page)) = query else {
        return error(StatusCode::BAD_REQUEST, "invalid-query");
    };
    let limit = page.limit.unwrap_or(20);
    let offset = page.offset.unwrap_or(0);
    if !(1..=100).contains(&limit) || !(0..=480).contains(&offset) {
        return error(StatusCode::BAD_REQUEST, "invalid-query");
    }
    let result = (|| -> rusqlite::Result<Vec<Item>> {
        let db = state.db.lock().expect("database lock poisoned");
        let mut stmt = db.prepare_cached(
            "SELECT id, title, body FROM items WHERE user_id = ? ORDER BY id LIMIT ? OFFSET ?",
        )?;
        stmt.query_map((&verified.claims.sub, limit, offset), |row| {
            Ok(Item {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
            })
        })?
        .collect()
    })();
    match result {
        Ok(items) => Json(Items {
            user_id: verified.claims.sub,
            items,
        })
        .into_response(),
        Err(err) => {
            eprintln!("database: {err}");
            error(StatusCode::INTERNAL_SERVER_ERROR, "internal")
        }
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db =
        Connection::open_with_flags(std::env::var("BENCH_DB")?, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    db.execute_batch("PRAGMA cache_size=-2048;")?;
    db.set_prepared_statement_cache_capacity(16);
    let key = DecodingKey::from_rsa_pem(std::env::var("BENCH_PUBLIC_KEY")?.as_bytes())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&["https://bench.invalid"]);
    validation.set_audience(&["server-bench"]);
    validation.leeway = 0;
    validation.validate_nbf = true;
    let app = Router::new()
        .route(
            "/",
            get(|| async { "{\"ok\":true,\"service\":\"server-bench\"}" }),
        )
        .route("/api/bench/items", get(items))
        .with_state(Arc::new(AppState {
            db: Mutex::new(db),
            key,
            validation,
        }));
    let port: u16 = std::env::var("PORT")?.parse()?;
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
