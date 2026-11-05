//! Optional native API service. Expo SSR continues to run in Bun.
//! These endpoints contain public demonstration data, never user records.
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Query, Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::Instant,
};

struct AppState {
    started: Instant,
    requests: AtomicU64,
    errors: AtomicU64,
    db: Mutex<Connection>,
}

#[derive(Deserialize)]
struct Page {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Serialize)]
struct Item {
    id: i64,
    title: String,
    body: String,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "ok": true, "runtime": "rust", "framework": "axum",
        "pid": std::process::id(), "uptimeSeconds": state.started.elapsed().as_secs_f64(),
        "requests": state.requests.load(Ordering::Relaxed),
        "errors": state.errors.load(Ordering::Relaxed),
    }))
}

async fn items(
    State(state): State<Arc<AppState>>,
    query: Result<Query<Page>, axum::extract::rejection::QueryRejection>,
) -> Response {
    let Ok(Query(page)) = query else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid-query"})),
        )
            .into_response();
    };
    let limit = page.limit.unwrap_or(20);
    let offset = page.offset.unwrap_or(0);
    if !(1..=100).contains(&limit) || !(0..=5000).contains(&offset) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid-query"})),
        )
            .into_response();
    }
    // SQLite work stays off the async request loop. A single bounded cache and
    // connection suit this read-only demo; choose a pool for an app's real DB.
    match tokio::task::spawn_blocking(move || -> rusqlite::Result<Vec<Item>> {
        let db = state.db.lock().expect("database lock poisoned");
        let mut statement =
            db.prepare_cached("SELECT id, title, body FROM items ORDER BY id LIMIT ? OFFSET ?")?;
        statement
            .query_map((limit, offset), |row| {
                Ok(Item {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    body: row.get(2)?,
                })
            })?
            .collect()
    })
    .await
    {
        Ok(Ok(items)) => {
            Json(json!({"source": "rust-sqlite-demo", "items": items})).into_response()
        }
        result => {
            eprintln!("database request failed: {result:?}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal"})),
            )
                .into_response()
        }
    }
}

async fn echo(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({"runtime": "rust", "echo": body}))
}

async fn observe(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response {
    let started = Instant::now();
    let method = request.method().to_string();
    // Do not log query strings, headers, or bodies: these may contain secrets.
    let path = request.uri().path().to_owned();
    let mut response = next.run(request).await;
    state.requests.fetch_add(1, Ordering::Relaxed);
    if response.status().is_server_error() {
        state.errors.fetch_add(1, Ordering::Relaxed);
    }
    response
        .headers_mut()
        .insert("cache-control", "no-store".parse().unwrap());
    response
        .headers_mut()
        .insert("x-content-type-options", "nosniff".parse().unwrap());
    println!(
        "{}",
        json!({"event": "request", "method": method, "path": path,
        "status": response.status().as_u16(), "durationMs": started.elapsed().as_secs_f64() * 1000.0})
    );
    response
}

async fn shutdown() {
    let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("install SIGTERM handler");
    tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
    println!("{}", json!({"event": "shutdown"}));
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tokio::runtime::Builder::new_current_thread()
        .max_blocking_threads(2)
        .enable_all()
        .build()?
        .block_on(run())
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let port: u16 = std::env::var("RUST_PORT")
        .unwrap_or_else(|_| "3001".into())
        .parse()?;
    // Loopback by default: put a properly configured gateway in front for deployment.
    let host = std::env::var("RUST_HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let db_path =
        std::env::var("RUST_DEMO_DB").unwrap_or_else(|_| ".build/rust-demo.sqlite".into());
    if let Some(parent) = std::path::Path::new(&db_path)
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent)?;
    }
    let mut db = Connection::open(db_path)?;
    db.execute_batch("PRAGMA cache_size=-2048; CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL);")?;
    {
        let transaction = db.transaction()?;
        {
            let mut insert = transaction.prepare("INSERT OR IGNORE INTO items VALUES (?, ?, ?)")?;
            for id in 1..=5000 {
                insert.execute((
                    id,
                    format!("Item {id}"),
                    format!(
                        "Public demo content {id}: {}",
                        "SQLite read from Rust. ".repeat(10)
                    ),
                ))?;
            }
        }
        transaction.commit()?;
    }
    db.execute_batch("PRAGMA query_only=ON;")?;
    db.set_prepared_statement_cache_capacity(16);
    let state = Arc::new(AppState {
        started: Instant::now(),
        requests: AtomicU64::new(0),
        errors: AtomicU64::new(0),
        db: Mutex::new(db),
    });
    let app = Router::new()
        .route("/api/rust/health", get(health))
        .route("/api/rust/items", get(items))
        .route("/api/rust/echo", post(echo))
        .fallback(|| async { (StatusCode::NOT_FOUND, Json(json!({"error": "not-found"}))) })
        .layer(DefaultBodyLimit::max(8192))
        .layer(middleware::from_fn_with_state(state.clone(), observe))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind((host.as_str(), port)).await?;
    println!(
        "{}",
        json!({"event": "listening", "address": listener.local_addr()?.to_string(), "pid": std::process::id()})
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}
