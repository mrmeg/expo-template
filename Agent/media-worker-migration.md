---
status: blocked
mode: HITL
base-branch: dev
blocked-by: media-worker-deploy merged and the Worker live + smoke-tested at cdn.mrmeg.com/api/media/*; user to supply the old worker's name/routes and the exact endpoints downrangedays and terlo currently call
pr: -
---

# Migrate consumers to the media Worker and retire the old worker (phase 3)

## Goal

Finish the media-worker plan: move downrangedays and terlo off the old
cdn.mrmeg.com worker onto the new `/api/media/*` contract, then tear the old
worker down. This repo's deliverables are a migration guide and the teardown
checklist — the client-code changes happen in the external downrangedays and
terlo repos and cannot be implemented from here.

## Context

- Phase 2 (`media-worker-deploy.md`) ships the new Worker route-scoped to
  `cdn.mrmeg.com/api/media/*`, so the old worker keeps serving its existing
  paths during the transition.
- Auth for the new contract is static per-app bearer tokens in the `MEDIA_AUTH`
  KV namespace (`token:<token>` → `{"app": "..."}`), provisioned via
  `wrangler kv key put`.
- Unknown until the user supplies it: the old worker's name, its route
  patterns, which endpoints downrangedays/terlo call today, and whether any
  other consumer exists. Do not guess these — the teardown checklist must name
  them explicitly.

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

- Old worker name, route patterns, and current API surface consumed by
  downrangedays/terlo — required before the mapping table and teardown steps can
  be written. (This is the blocked-by.)
