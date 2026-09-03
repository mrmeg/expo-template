---
status: ready
mode: HITL
base-branch: dev
blocked-by: -
pr: -
---

# Migrate consumers to the media Worker and retire the old workers (phase 3)

## Goal

Finish the media-worker plan: move downrangedays and terlo onto the new
`cdn.mrmeg.com/api/media/*` contract, then retire their bespoke media plumbing.
This repo's deliverables are a migration guide and the teardown checklist — the
client-code changes happen in the external downrangedays and terlo repos and
cannot be implemented from here.

## Context

- Phase 2 (`media-worker-deploy.md`, PR #78 merged) shipped the Worker code,
  and it is **deployed and smoke-tested** (2026-09-03): script `media`, route
  `cdn.mrmeg.com/api/media/*`, fronting R2 bucket `mrmeg` (whose R2 custom
  domain is `cdn.mrmeg.com` — other paths keep serving the public bucket).
  `MEDIA_AUTH` KV namespace `195923b605444522b01d6ff3f8565f62`; R2 secrets set
  via `wrangler secret put` (reused from the old `mrmeg-media` config — rotate
  during teardown since they lived in plaintext `[vars]`). Verified live:
  401 without/with bad token, 404 unknown action, 405 wrong method, `list` 200,
  and a full getUploadUrl → PUT → getSignedUrls → GET → delete round-trip. No
  per-app tokens are provisioned yet; the smoke-test token was deleted.
- Auth for the new contract is static per-app bearer tokens in the `MEDIA_AUTH`
  KV namespace (`token:<token>` → `{"app": "..."}`), provisioned via
  `wrangler kv key put`.
- **There is no old worker on cdn.mrmeg.com.** Verified 2026-09-02 via the
  Cloudflare API (account `776658da55f21acb7c2b201bfa3096db`):
  - Deployed scripts: `alchemy-state-store`, `downrangedays`,
    `laura-hudson-review-form`, `mrmeg-web`, two `t3coderelay-*` workers,
    `wagbi`. No shared media worker exists.
  - **downrangedays** (deployed, custom domain `cdn.downrangedays.com`, bucket
    `downrangedays`): object-level surface — `GET`/`PUT`/`DELETE` on `/<key>`
    validated by an HS256 JWT `?token=` that the app's server mints
    (`server/r2.ts`), plus HLS playlist/segment handling
    (`handleHlsGet`, playlist rewriting). The app
    (`~/Development/downrangedays`) also runs its own Expo API routes:
    `/api/media/getUploadUrl`, `/api/media/getSignedUrls`, `/api/media/index`,
    `/api/media/[id]`, `/api/media/file/[...key]`. Worker source:
    `~/Development/serverless_functions/cloudflare/downrangedays`.
  - **terlo**: no worker deployed and `cdn.terlo.app` has no DNS record — the
    old worker source (`~/Development/serverless_functions/cloudflare/terlo`,
    bucket `hautemap`) never shipped or was already retired. The app
    (`~/Development/terlo/terlo`) already uses `@mrmeg/expo-media/server`
    `createMediaHandlers` inside its own `/api/media/[action]+api.ts` against
    R2 directly. It is already on the expo-media contract, self-hosted; its
    "migration" is repointing config at the shared Worker (or deciding to stay
    self-hosted).
  - Other old worker sources in `~/Development/serverless_functions/cloudflare`
    (`memoriam`, `mrmeg` → assets.mrmeg.com, `wagbi` →
    media.whosagoodboyindustries.co) belong to other apps; only `wagbi` is
    deployed. Out of scope here.
  - The old wrangler configs keep R2 access keys and JWT secrets in plaintext
    `[vars]` (committed to disk). Teardown must rotate the R2 API
    tokens/keys and retire the JWT secrets, not just delete workers.
- Migration-shape consequence: downrangedays is the real migration — its
  bespoke JWT-serving worker and in-app routes get replaced by the shared
  contract, and its public-URL + HLS serving path has no direct equivalent in
  the new Worker (which only signs R2 URLs via `getSignedUrls`). That gap is
  the likely candidate for the separate spec in Work item 3.

## Work

1. `docs/media-worker-migration.md`: consumer-facing guide —
   - New base URL and route table (`list`, `getUploadUrl`, `getSignedUrls`,
     `delete` single/batch), request/response shapes, and the
     `Authorization: Bearer` requirement.
   - How to consume it from an Expo app with `@mrmeg/expo-media/client`
     (pointing the client at `https://cdn.mrmeg.com/api/media` + token) versus
     raw fetch.
   - Old-endpoint → new-endpoint mapping table (filled in once the old contract
     is known).
   - Per-app checklists for downrangedays and terlo (token provisioning, code
     touchpoints, verification).
2. Teardown checklist (same doc or `workers/media/README.md` appendix), gated on
   both apps confirmed migrated: remove the old worker's routes, delete the
   worker, delete stale secrets/KV, and if the new Worker should own the whole
   hostname, widen its route from `/api/media/*` deliberately at that point.
3. If phase 3 surfaces gaps in the Worker (e.g. per-app prefix scoping via
   `MediaTokenAuth.app`), spec that separately rather than folding it in here.

## Validation

- Guide reviewed against the live Worker: every documented curl runs as written.
- Old endpoints return the expected post-teardown behavior (404/no route) only
  after both apps confirm they are on the new contract.

## Out of scope

- Code changes inside the downrangedays and terlo repositories (done there,
  following the guide).
- New Worker features; per-app policy scoping gets its own spec if needed.

## Open questions

- Does terlo move to the shared Worker or stay self-hosted on
  `@mrmeg/expo-media/server`? (It already speaks the contract; the shared
  Worker only buys it centralized ops.)
- How does downrangedays' public-URL + HLS serving map onto the signed-URL-only
  contract — extend the Worker (separate spec per Work item 3) or accept
  presigned R2 URLs for playback?
