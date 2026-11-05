# Server memory comparison

For live metrics, console logs, and in-app benchmark controls, run
`bun run build` then `bun run server:lab` and open `/server-lab`.
See the [Rust API and lab guide](../server/rust/README.md).

Run equivalent small JSON APIs on bare `node:http`, native `Bun.serve`, and
Rust Hyper/Tokio. This measures a runtime/HTTP baseline, not the template app.
The production template already uses Bun without Express.
An additional `api` workload compares a local authenticated database API,
using Axum for the Rust server.

## Run

Requires macOS or Linux (`ps`), Node, Bun, and Cargo for Rust. Build Rust once;
compilation is excluded from the measurements. The release build uses Tokio's
single-thread runtime so all three servers execute application work on one
thread; runtime helper threads can still differ.

```sh
cargo build --locked --release --manifest-path scripts/server-bench/rust/Cargo.toml --target-dir .build/server-bench-rust
bun run bench:server
# Without Rust:
bun run bench:server --targets=node,bun
# Longer load and recovery window:
bun run bench:server --duration=60 --cooldown=30 --rps=500 --concurrency=20
# Authenticated SQLite API (Axum for Rust):
bun run bench:server --workload=api --duration=20 --repeats=3
```

Default: three fresh processes per target, rotating target order, one second
settling after readiness, three seconds of warmup, ten seconds of measured
load, five seconds of recovery. All serve the same status, JSON bytes, and
content type for the default `tiny` workload. HTTP keepalive is enabled, with
no TLS, application logging, database, auth, compression, or framework in that
workload. Servers bind loopback only.

The Node load generator is a separate, unmeasured process on the same host.
It paces 200 requests/second across ten workers by default. A slow worker
does not accumulate an unlimited queue; achieved throughput falls if a server
cannot keep up. This is a paced, concurrency-limited comparison, not an
open-loop overload test or maximum-throughput benchmark. Compare memory only
when achieved throughput and latency meet the same requirement. Each response
is checked for status and exact body; request errors fail the run.

## Authenticated database API

`--workload=api` runs `GET /api/bench/items?limit=20&offset=0`:

1. Verify an RS256 JWT against a cached test key, including issuer, audience,
   expiry, and subject checks. JavaScript uses the repo's `aws-jwt-verify`;
   Rust uses `jsonwebtoken` with its RustCrypto provider. JavaScript uses
   synchronous verification with a preloaded JWKS, so no key lookup performs
   network I/O. This is generic JWT auth, not a complete Cognito/Clerk integration.
2. Execute an indexed SQLite query scoped to the verified subject. Each server
   has one read-only connection, a prepared statement, and a 2 MiB page-cache
   limit. Node uses `node:sqlite`, Bun uses `bun:sqlite`, Rust uses `rusqlite`
   with bundled SQLite. SQLite versions and build options can differ.
3. Serialize 20 records, roughly 6 KiB of JSON. The load rotates across ten
   users and five pages per user; it does not cache responses or verified tokens.

The runner creates a temporary database with 5,000 records and generates an
ephemeral RSA-2048 signing key. The private key stays in the load generator;
only public key material goes to the servers. Fixtures are removed after the
run. Bun's automatic `.env` loading is disabled. No production services are used.

Before warmup in every process, 67 checks cover all user/page results,
missing/malformed/tampered/expired tokens, wrong issuer/audience/algorithm/key,
empty subjects, future activation, invalid pagination, methods, and paths.
Every measured response is parsed and compared with the expected user's rows;
latency includes that client-side validation. Idle memory is recorded before
these checks; measured peak memory follows checks and warmup.

The Rust API is in `scripts/server-bench/rust/src/bin/axum-api.rs` and the shared
Node/Bun implementation in `scripts/server-bench/api.mjs`. All application work
runs on a single event-loop thread, including synchronous SQLite reads and
signature checks. This deliberately uses the same execution model across the
targets; a deployed service needs its own concurrency and blocking-I/O design.

This workload adds actual signature verification, database reads, and JSON
serialization, but remains synthetic. It excludes the Expo adapter, SSR,
provider-specific auth rules, JWKS refresh, remote database pools, writes,
storage/billing SDKs, TLS, CORS, rate limits, compression, and access logs.
It is neither a drop-in Expo server nor a production authentication service.

Output includes runtime versions, configuration, JSON rows, and a table:

- `idleMiB`: process RSS after readiness and settling, before warmup.
- `peakMiB`: highest sampled RSS during measured load (200 ms interval,
  including boundaries). This can miss brief peaks and excludes warmup peaks.
- `postLoadMiB`: RSS after connections close and the recovery period ends.
- `rps`, `p95ms`, `errors`: achieved successful throughput, successful-request
  latency, and failed requests. Latency is measured from actual dispatch;
  it excludes time waiting for a worker to become available.

RSS includes resident runtime and native allocations, whereas JS heap metrics
cover only part of a process. See [Node memory metrics](https://nodejs.org/api/process.html#processmemoryusage).
No garbage collection is forced. Short recovery measurements do not establish
whether a process leaks. Sampling and load generation use the same machine,
so they can affect latency. Do not treat local macOS RSS as Linux container
billing: measure the deployed host's container metric, including child
processes, shared pages, and any filesystem cache charged by the provider.

## Apply the comparison to an app

First establish the smallest useful server floor with this benchmark. Then
compare the same production API workload with equivalent parsing, auth,
validation, database pool limits, response sizes, and caching. Use a fixed
representative request rate and concurrency, then sustained load, a burst,
and recovery. Measure memory alongside errors, latency, and CPU; reducing
memory while needing more replicas may cost more overall.

For Expo SSR, benchmark the built app separately (`bun run build`, then
`bun run start`) with its actual route mix and payloads. A JSON API cannot
stand in for React rendering. Node can run JavaScript SSR; a Rust or Go API
does not replace Expo's renderer. Retaining SSR in a separate JS service adds
another process whose memory belongs in the total.

Rust's ownership model avoids a garbage collector, making it a candidate for
small resident API services, but it does not guarantee an application uses
less memory; see [Rust ownership](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html).
Include a Go `net/http` service as another candidate if a simpler rewrite is
valuable; it has a [standard HTTP server](https://pkg.go.dev/net/http) and
[garbage collector memory tuning](https://go.dev/doc/gc-guide).
Neither Go nor full application ports are included in these benchmarks.

Before rewriting, inspect process counts, eagerly imported SDKs, caches,
database pools, SSR requirements, and buffered media. On Terlo, a production
Expo app, running the same app on Bun instead of Node gave no clear result:
under different traffic, the host's container metric read 609 vs 556 MB while
process RSS read 369 vs 594 MB. A Rust API could not replace the JavaScript
renderer. The worst growth came from per-request React Query timers, fixed in
about 20 lines of cache configuration. Check whether static
web hosting plus an API would satisfy each app. Estimate savings using the
provider's actual billing model and measured total service memory; do not
extrapolate the small JSON endpoint's percentage reduction to the app.
