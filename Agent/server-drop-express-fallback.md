---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Drop the Express fallback server

## Goal
One production server path. Delete the Express fallback (`server/index.ts`),
its two npm scripts, and the five npm dependencies that exist only for it.
Removes ~146 LOC plus five deps and a doc-maintenance burden: today the whole
middleware stack (CORS, security headers, request-ID, rate limits,
compression, static serving, ffmpeg route, expo-server handoff) is
implemented twice.

## Context
- Primary server: `server.bun.ts` (493 LOC, Bun.serve +
  `expo-server/adapter/bun`), run by `bun run start` / `start-local`.
- Fallback: `server/index.ts` (146 LOC, Express 5 +
  `expo-server/adapter/express`), run only by `start:express` /
  `start-local:express`.
- Nothing else uses the Express path: no CI job boots either server, there is
  no deploy config in-repo (no railway.*/Procfile), no test imports it. The
  only server tests target the shared modules `server/rateLimits.js` and
  `server/ffmpegWorker.js`, which both servers import and which stay.
- The five devDependencies `express`, `express-rate-limit`, `compression`,
  `cors`, `morgan` are imported ONLY by `server/index.ts` (verified by grep
  across `server/`, `scripts/`, `client/`, `app/`). Route-level CORS
  (`server/api/shared/cors.ts`) is hand-rolled and does not use the `cors`
  package.
- Doc references to the Express fallback: `README.md` lines 24, 98–99, 198,
  458; `docs/server-guide.md` lines 16, 74–75, 241;
  `docs/migration-guide.md:118`; `AGENTS.md:42` (tech-stack row "Bun server
  plus Express fallback"). `llms-full.txt` embeds server-guide and is
  regenerated.
- Rationale for dropping rather than keeping Express: the template's scripts,
  docs, and local workflow are Bun-first (`bun.lock`, CI installs with bun);
  the fallback exists for "hosts without Bun", which no supported deploy path
  in this repo exercises.

## Work
1. Delete `server/index.ts`.
2. Remove `start:express` and `start-local:express` from `package.json`
   scripts; remove devDependencies `express`, `express-rate-limit`,
   `compression`, `cors`, `morgan`; run `bun install` to update `bun.lock`.
3. Update docs at the lines listed in Context: remove/replace Express
   fallback mentions; change the `AGENTS.md` tech-stack row to Bun only.
   Where server-guide describes "both servers", rewrite to describe
   `server.bun.ts` alone.
4. Fix the stale line in `server/ffmpegWorker.js`'s header that says the
   worker is served by "server/index.ts … (prod)" — production serving is
   `server.bun.ts` `serveFfmpegWorker()`. (Skip if
   `media-delete-stale-lib-fork` already fixed it.)
5. Regenerate LLM docs: `bun run docs:llms` and commit the result.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci`
- `grep -rn "express" server scripts package.json --include='*' -i` shows no
  remaining runtime references (allow unrelated matches like
  "expression").
- `bun run build && bun run start`, then confirm `curl -I
  http://localhost:3000/` returns 200 with the security headers, and an API
  route (e.g. `/api/template/health` or any existing `app/api` route)
  responds.
- `bun run docs:llms:check` and `bun run docs:versions:check` pass.

## Out of scope
- Consolidating the three CORS layers (`server.bun.ts` server-level,
  `server/api/shared/cors.ts` route-level, `app/+middleware.ts` Vary tweak) —
  separate decision, not this spec.
- Any change to `server.bun.ts` behavior.

## Merge plan
Overlaps `media-delete-stale-lib-fork` only on `server/index.ts` (deleted
here, comment-edited there) and `docs-ssr-truth-sweep` on
`docs/server-guide.md` / `README.md` (different lines). Land in any order;
conflicts are line-local.
