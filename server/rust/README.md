# Optional Rust API

Axum + Tokio API service for examining a native backend alongside Expo. Bun
continues to render Expo routes; Rust does not execute Expo's JavaScript export.
The default `bun run start` stays Bun-only.

```sh
# From the repository root; requires Rust/Cargo, Node, and Bun.
bun run build
bun run server:lab
# Open http://localhost:3000/server-lab (also listed in Explore → Demos & Tools).
```

The local supervisor builds both Rust binaries, starts Bun SSR and Rust on
private loopback ports, and serves one local origin. `/api/rust/*` goes to
Rust; other application requests go to Bun. Ctrl+C stops the services and
any running benchmark. `SERVER_LAB_PORT=3100 bun run server:lab` changes the
public port. The supervisor launches Bun with `--no-env-file`; it inherits
shell environment variables but does not automatically load the repo's `.env`.

The lab page polls once per second for externally sampled process RSS, a
60-sample history, bounded console logs, and benchmark progress. It separates
the combined Bun + Rust application memory from the Node supervisor, runner,
and isolated Node/Bun/Rust benchmark children. Results and logs last only for
the current supervisor session. Pausing updates does not stop a test; Stop
comparison cancels it. Clear view hides existing logs in that browser only.

The gateway binds to `127.0.0.1`, checks Host and browser Origin, and has no CORS
allowance. Its start/stop controls accept only fixed workloads and profiles.
It is a local development tool: do not publish it or put a tunnel in front of
it. Console output can include application details. The production entry
never includes the lab's log or process-control endpoints. Ordinary production
or Expo dev servers show setup instructions on `/server-lab`.

## Native routes

| Route | Behavior |
| --- | --- |
| `GET /api/rust/health` | Runtime, PID, uptime, request count, server error count |
| `GET /api/rust/items?limit=20&offset=0` | Public SQLite demo rows; limit 1–100, offset 0–5000 |
| `POST /api/rust/echo` | Echo JSON, maximum request body 8 KiB |

SQLite seeds 5,000 public rows in `.build/rust-demo.sqlite` on startup, then
enables query-only mode. `RUST_DEMO_DB` can change this demo database location.
The service uses a 2 MiB SQLite page-cache target, one connection, and at most
two blocking worker threads so SQLite does not block Tokio's request loop.
Request logs omit query strings, headers, and bodies. SIGINT/SIGTERM drains
in-flight requests before exit; the local supervisor enforces a shutdown limit.
This starter targets macOS and Linux.

For a standalone API process:

```sh
bun run server:rust:build
bun run server:rust
# http://127.0.0.1:3001/api/rust/health
```

`RUST_HOST` defaults to `127.0.0.1`; `RUST_PORT` defaults to `3001`. Serving
Rust separately does not automatically route the Expo app's requests to it;
the lab's gateway supplies that integration locally. A deployment would need
its own gateway and routing policy.

These public demo endpoints are deliberately independent of Clerk/Cognito,
Stripe, and media storage. They do not replace authenticated template APIs.
Before moving user data into Rust, port the provider-specific token validation,
key rotation, authorization, rate limits, CORS/security policy, request limits,
timeouts, and database pooling appropriate to that app. The in-UI comparison
uses the separate [benchmark fixtures](../../docs/server-bench.md), including
an ephemeral test RSA key; those keys never authorize the native demo service.

## Checks

```sh
bun run server:lab:test
cargo fmt --check --manifest-path server/rust/Cargo.toml
cargo clippy --locked --manifest-path server/rust/Cargo.toml --target-dir .build/server-rust -- -D warnings
```
