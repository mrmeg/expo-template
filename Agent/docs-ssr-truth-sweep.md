---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/70
---

# Fix stale "web is client-rendered" docs — SSR is on

## Goal
Since PR #64 (merged 2026-08-14) the web build server-renders routes per
request (`app.config.ts:72` sets `unstable_useServerRendering: true`), but
the docs — including agent-facing AGENTS.md and the LLM bundle — still assert
the opposite. Anyone (human or agent) reading them gets a factually inverted
mental model. Sweep every stale claim, plus one wrong SDK version.

## Context
Verified current behavior: `app.config.ts:72` has
`unstable_useServerRendering: true`; the SSR support machinery exists at
`server/lib/ssrViewport.ts`, `server/lib/ssrOnboarding.ts`,
`client/features/app/SsrStyleFlush.tsx`,
`client/features/app/ssrViewportMetrics.ts`. SSR serves real (non-shell)
content once the onboarding cookie is set; styles are registered at module
scope via `createThemedStyles` + `SsrStyleFlush` so the SSR head snapshot
includes them.

Stale statements (exact locations):
- `AGENTS.md:51` — "Web is client-rendered: `web.output: "server"` runs API
  routes … but routes are not server-rendered per request." Keep the
  still-valid verification guidance (`bun run build && bun run start`, not
  only Jest/tsc) while correcting the rendering claim.
- `llms.txt:3` — "client-rendered web on a Bun server" AND "Expo SDK 56"
  (repo is SDK 57; `scripts/check-readme-versions.mjs` guards README only,
  so this drifted silently).
- `README.md:13` and `README.md:447` — "server-hosted, client-rendered web
  build".
- `docs/server-guide.md:56–61` — "There is deliberately no
  `unstable_useServerRendering`. Web routes are client-rendered … Turning
  per-request rendering back on reintroduces …" — factually inverted;
  rewrite to describe the current SSR setup and what it requires
  (module-scope style registration, the `+html.tsx` snapshot filter, the
  externals note in `metro.config.js`).
- `docs/server-guide.md:132–140` — the "When loaders run" paragraph is
  premised on "Because routes are client-rendered (no
  `unstable_useServerRendering`)". Re-verify the actual loader timing
  against the code (`expo-router` data loaders under SSR run on the server
  per request) and rewrite the paragraph — this is a semantic rewrite, not a
  word swap.
- `docs/template-modernization-guide.md:34` ("client-rendered web output")
  and `:59` ("Web routes are client-rendered…").
- `docs/migration-guide.md:104–107` — "there is deliberately no
  `unstable_useServerRendering`: routes are client-rendered".

Downstream: `llms-full.txt` / `llms-examples.txt` are generated from these
docs by `scripts/build-llms-full.mjs`; regenerate after editing.

## Work
1. Correct every location above. Where a passage explains *why* SSR is off,
   replace it with the current rationale/requirements (see Context), not
   just a negation flip.
2. Fix `llms.txt:3` SDK version to 57 (and rendering wording).
3. `bun run docs:llms` and commit the regenerated files.

## Validation
- `bun run docs:llms:check` and `bun run docs:versions:check` pass.
- `grep -rni "client-rendered" README.md AGENTS.md llms.txt docs/` returns
  only lines that are intentionally about the pre-SSR era or native
  behavior (expect zero, or justify each survivor in the PR description).
- `grep -n "SDK 56" llms.txt llms-full.txt README.md docs/ -r` returns
  nothing.
- `bun run build && bun run start`, then `curl -s http://localhost:3000/ |
  head -c 2000` to confirm the response is server-rendered markup (sanity
  that the docs now match reality; note the onboarding-cookie gate may show
  the onboarding variant).

## Out of scope
- Any code change to SSR behavior.
- Express-fallback doc lines (`server-drop-express-fallback` owns those).
- README feature descriptions beyond the rendering/SDK claims.

## Merge plan
Overlaps `server-drop-express-fallback` in `README.md` /
`docs/server-guide.md` at different lines, and both regenerate
`llms-full.txt` — whichever lands second reruns `bun run docs:llms` on
rebase.
