---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Deploy @mrmeg/expo-media handlers as a Cloudflare Worker (media-worker phase 2)

## Goal

Make `@mrmeg/expo-media` deployable as a standalone Cloudflare Worker serving the
media API at `cdn.mrmeg.com/api/media/*`, so consumer apps (downrangedays, terlo)
can call one shared endpoint instead of each bundling their own Expo API routes.
Two deliverables:

1. A new `./worker` subpath in `packages/media` — Worker routing + KV bearer-token
   auth helper — published as `@mrmeg/expo-media@0.4.0`.
2. A deployable Worker app at `workers/media/` in this repo, deployed manually with
   wrangler by the repo owner.

Decisions already settled (do not reopen): fresh URL contract mirroring the
template's `/api/media/*` route table (consumer apps migrate in phase 3, spec
`media-worker-migration.md`); auth is static per-app bearer tokens stored in
Workers KV; deployment is manual `wrangler deploy` from `workers/media/`, no CI
deploy; the Worker route is path-scoped (`cdn.mrmeg.com/api/media/*`) so anything
already serving other paths on that hostname keeps working until phase 3.

## Context

Verified against the repo at `dev` (a0c2925):

- `@mrmeg/expo-media@0.3.0` server runtime uses only `fetch` + Web Crypto
  (aws4fetch) — Workers-portable — **except**
  `packages/media/src/server/handlers.ts:658` and `:662`, which read
  `process.env.NODE_ENV`. On Workers without the `nodejs_compat` flag, `process`
  is undefined and `storageFailure` would throw `ReferenceError`.
- Route contract to mirror is `app/api/media/[action]+api.ts`:
  - `list`: GET; `getUploadUrl`: POST; `getSignedUrls`: POST;
    `delete`: DELETE (single, `?key=`) and POST (batch `{keys: []}`).
  - OPTIONS answered for known actions via `handlers.options`.
  - Unknown action → 404 `{code: "not-found", message}`; known action + wrong
    method → 405 `{code: "method-not-allowed", message}` (JSON bodies).
- `createMediaHandlers` (`packages/media/src/server/handlers.ts:128`) takes
  `{config, authorize, policy, events, cors, idFactory}` and returns
  `(request: Request) => Promise<Response>` handlers. `authorize` returning
  null/undefined yields 401 `{code: "unauthorized"}`. Config can be a factory.
  Handlers capture options at creation — but a Worker only receives `env` inside
  `fetch(request, env, ctx)`, so handler creation must be deferred to first fetch
  and cached per `env` object (stable per isolate; a `WeakMap<object, MediaHandlers>`
  works).
- Template wiring to copy from: `server/media/handlers.ts` (authorize + policy +
  cors shape) and `server/media/config.ts` (R2 config from env:
  `R2_JURISDICTION_SPECIFIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET`; `provider: "r2"`, `region: "auto"`, `forcePathStyle: true`; four
  media types avatars/videos/thumbnails/uploads with content-type allowlists and
  size caps).
- Repo plumbing that must track the new subpath:
  - `package.json:5` workspaces are `["packages/*"]` — `workers/*` must be added.
  - `jest.config.js` moduleNameMapper has one entry per `@mrmeg/expo-media/*`
    subpath; root `tsconfig.json` paths mirror them. Both need
    `@mrmeg/expo-media/worker` → `packages/media/src/worker/index.ts`.
  - Root `bun run typecheck` is repo-wide `tsc --noEmit`; `workers/media/` must
    not break it (own tsconfig + root exclude if the base config sweeps it in).
  - `scripts/check-package-consumer.mjs:311` enumerates entrypoints to smoke-test;
    add `{ entrypoint: "@mrmeg/expo-media/worker", key: "./worker" }`.
  - `.github/workflows/publish-media.yml` publishes on push to main when
    `packages/media/package.json` changes — bumping to 0.4.0 publishes
    automatically once dev is promoted. Do not publish manually.
- `packages/media` must not gain a dependency on `@cloudflare/workers-types`:
  the published subpath uses minimal structural types (e.g.
  `{ get(key: string): Promise<string | null> }` for KV). Only `workers/media/`
  (private, unpublished) uses real Workers types.
- Pre-commit gates (lefthook): typecheck, lint, gen checks, `docs:llms:check`.
  README/LLM_USAGE edits in `packages/media` may require `bun run docs:llms`.

## Work

1. **Portability fix** — `packages/media/src/server/handlers.ts`: replace the two
   direct `process.env.NODE_ENV` reads with a guarded helper
   (`typeof process !== "undefined" ? process.env?.NODE_ENV : undefined`).
   Behavior in Node/Jest is unchanged; on Workers the code path treats NODE_ENV
   as undefined (logs errors, includes error details — acceptable).

2. **New subpath `packages/media/src/worker/index.ts`** exporting:
   - `createMediaWorker<TEnv extends object>(options)` returning
     `{ fetch(request: Request, env: TEnv, ctx?: unknown): Promise<Response> }`
     (assignable to a Worker `export default`). Options:
     - `createOptions: (env: TEnv) => CreateMediaHandlersOptions<any>` — called
       once per env instance; result passed to `createMediaHandlers` and cached
       in a `WeakMap`.
     - `basePath?: string` — default `"/api/media"`. Requests whose pathname is
       not `${basePath}/{action}` get 404 `not-found`.
     - Routing table and error shapes exactly as `app/api/media/[action]+api.ts`
       (including OPTIONS dispatch and 405 for known-action/wrong-method). CORS
       headers on 404/405 responses come from the created options' `cors`
       callbacks, matching how the handlers themselves attach CORS.
   - `createKvTokenAuthorizer(kv: MediaTokenStore)` returning an
     `authorize`-compatible `(request: Request) => Promise<MediaTokenAuth | null>`:
     - Reads `Authorization: Bearer <token>`; missing/malformed → null (→ 401).
     - Looks up KV key `token:<token>`; missing → null. Value is JSON metadata
       (at minimum `{ app: string }`); returns `{ token: string; app: string; metadata }`.
       Malformed JSON → treat as null and log via console.warn.
   - `MediaTokenStore` structural type: `{ get(key: string): Promise<string | null> }`.
   - Export the new types (`CreateMediaWorkerOptions`, `MediaTokenAuth`,
     `MediaTokenStore`) from the subpath index.

3. **Package wiring**:
   - `packages/media/package.json`: version `0.4.0`; add `./worker` exports entry
     (`dist/worker/index.{js,d.ts}`); keywords may add `cloudflare-workers`.
   - `jest.config.js` + root `tsconfig.json`: add the `@mrmeg/expo-media/worker`
     mapping.
   - `scripts/check-package-consumer.mjs`: add the `./worker` entrypoint check
     (assert `createMediaWorker` loads, mirroring the `./server` check pattern).
   - `packages/media/README.md` + `LLM_USAGE.md`: short "Cloudflare Worker"
     section (createMediaWorker + KV authorizer usage). Add a CHANGELOG entry for
     0.4.0. Run `bun run docs:llms` if `docs:llms:check` fails.

4. **Tests** — `packages/media/src/worker/__tests__/worker.test.ts` (fetch-mock
   style like the existing server tests; `resetMediaStorageForTests` between
   tests):
   - Routing parity: every action/method pair dispatches; unknown action → 404
     `not-found`; known action wrong method → 405 `method-not-allowed`; OPTIONS
     on known action → 200 with preflight headers, unknown → 404.
   - `createOptions` called once per env object (cache hit on second fetch, new
     env object → new handlers).
   - KV authorizer: no header → 401; unknown token → 401; valid token → request
     proceeds (assert a mocked signed-URL happy path returns 200 and the auth
     object reaches a `policy.canRead` spy).
   - Malformed KV JSON → 401, no throw.

5. **Deployable app `workers/media/`** (private workspace, never published):
   - Root `package.json`: workspaces `["packages/*", "workers/*"]`; run
     `bun install` after.
   - `workers/media/package.json`: `"name": "@mrmeg/media-worker"`, private,
     deps `@mrmeg/expo-media` (workspace), devDeps `wrangler`,
     `@cloudflare/workers-types`, `typescript`; scripts `deploy`, `dev`,
     `typecheck`.
   - `workers/media/wrangler.jsonc`: `name: "media"`, `main: "src/index.ts"`,
     current `compatibility_date`, route
     `{ pattern: "cdn.mrmeg.com/api/media/*", zone_name: "mrmeg.com" }`,
     `kv_namespaces: [{ binding: "MEDIA_AUTH", id: "<placeholder — created at deploy time>" }]`,
     `vars` for `R2_BUCKET` and `R2_JURISDICTION_SPECIFIC_URL` (placeholders).
     Secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` are NOT in the file —
     set via `wrangler secret put`.
   - `workers/media/src/index.ts`: build `MediaConfig` from `env` (same four
     media types as `server/media/config.ts`, reading the R2 values from `env`
     instead of `process.env`); `authorize: createKvTokenAuthorizer(env.MEDIA_AUTH)`
     wired inside `createOptions`; CORS reflecting the request Origin with
     standard method/header allowances; `export default createMediaWorker({...})`.
   - `workers/media/tsconfig.json`: standalone (not extending expo base), types
     `@cloudflare/workers-types`. Ensure root `bun run typecheck`, `bun run lint`,
     and jest do not sweep `workers/` (add root tsconfig/eslint/jest excludes as
     needed — verify each gate before and after).
   - `workers/media/README.md` deploy runbook (user-run, not part of this shift):
     `wrangler kv namespace create MEDIA_AUTH` → paste id;
     `wrangler secret put R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`;
     provision a token:
     `wrangler kv key put --binding MEDIA_AUTH "token:$(openssl rand -hex 32)" '{"app":"downrangedays"}'`;
     `wrangler deploy`; smoke curls (no token → 401; token + `GET /api/media/list?mediaType=avatars` → 200).

## Validation

- `bun run media:typecheck && bun run media:test && bun run media:build && bun run media:pack && bun run media:consumer-smoke`
- `bun run typecheck && bun run lint && bun run test:ci` (repo gates, including the
  three `app/api/media/__tests__` suites which must stay green)
- `bun run docs:llms:check`
- `cd workers/media && bunx wrangler deploy --dry-run --outdir=dist-check` (bundles
  without credentials; proves the worker entry compiles and imports resolve)
- Manual, post-merge, by repo owner: runbook in `workers/media/README.md`, then
  live smoke curls against `cdn.mrmeg.com/api/media/*`.

## Out of scope

- Running the actual deployment (manual, user-run; the spec ships the runbook).
- Old-worker teardown and downrangedays/terlo client migrations — phase 3, spec
  `media-worker-migration.md`.
- Per-app key-prefix scoping / per-token policy beyond valid-token-gets-access
  (the `MediaTokenAuth.app` field is the extension point; wire policies in
  phase 3 if needed).
- Token issuance tooling or rotation automation (manual `wrangler kv key put`).
- CI deploy of the worker.

## Open questions

None blocking. The KV namespace id and any account-level wrangler settings are
deploy-time placeholders filled in by the repo owner during the runbook.
