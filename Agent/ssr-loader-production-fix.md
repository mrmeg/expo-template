---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Make data loaders survive production export (SSR loader detection gap)

## Goal
Production SSR exports currently ship **no data loaders**: the Babel pass
that tags loader routes skips re-export syntax, so the demo loader route
silently degrades (404 loader endpoint, swallowed SSR fetch error). Declare
the loader in the route file so the export detects it, add a guard so the
broken syntax can't come back, and fix the docs that still teach the broken
convention.

## Context
All verified against the current dev tree (post PR #68–#73):

- `app.config.ts` sets `unstable_useServerRendering: true`; loaders run per
  request under SSR when the export tags them.
- Detection: `expo export` decides which routes have loaders from
  `babel-preset-expo`'s `server-data-loaders-plugin`
  (`node_modules/babel-preset-expo/build/plugins/server-data-loaders-plugin.js`).
  Its `ExportNamedDeclaration` visitor bails when
  `path.node.exportKind === 'type' || specifiers.length > 0` (lines ~36–42),
  and only recognizes a `loader` **FunctionDeclaration** (line ~43) or
  **VariableDeclaration** whose declarator is named `loader` (line ~64).
- The only loader route, `app/(main)/(demos)/server-alpha/index.tsx:1`, uses
  the skipped shape: `export { serverAlphaLoader as loader } from
  "@/client/features/server-alpha/loaders"`.
- Verified failure symptoms on a production export (found during PR #70):
  no `loader` field on any `htmlRoutes` entry in
  `dist/server/_expo/routes.json`; `curl /_expo/loaders/server-alpha` → 404;
  an SSR request to `/server-alpha` logs `TypeError: fetch() URL is invalid`
  from the loader fetch, swallowed by the route's Suspense boundary. The dev
  server masks all of this — it marks every HTML route as having a loader.
- The gap is currently *documented* as a caveat rather than fixed:
  `docs/server-guide.md:247–259` ("Production detection gap"), the route-file
  sample at `docs/server-guide.md:294` + warning at `:299–300`, and
  `docs/migration-guide.md:149` (Phase 3 sample teaches the re-export shape).
- Stale pre-SSR comment flagged in PR #70 but out of its docs-only scope:
  `client/features/server-alpha/loaders.ts:5–12` still says "Web routes are
  client-rendered, so `expo export` runs each loader once during the export"
  — under SSR, loaders run per request; the param'd-route limitation
  argument needs rewording, not deleting (param'd routes still fetch an API
  route; see `ServerAlphaExampleScreen`).
- `client/features/server-alpha/__tests__/ServerAlphaExampleScreen.test.tsx:4–6`
  header repeats the same stale build-time-snapshot premise (comment only).

## Work
1. `app/(main)/(demos)/server-alpha/index.tsx`: replace the re-export with a
   declaration the plugin recognizes:
   ```ts
   import { serverAlphaLoader } from "@/client/features/server-alpha/loaders";
   export const loader = serverAlphaLoader;
   export { default } from "@/client/features/server-alpha/ServerAlphaDemoScreen";
   ```
   Inspect the export output before settling: (a) the client chunk for the
   route must not grow materially (the plugin strips the `loader` variable
   from client bundles; confirm the now-static `loaders.ts` import doesn't
   drag weight in — it is client-safe either way since its server imports are
   dynamic and in the current tree it is already in the client graph); (b)
   the emitted loader bundle should not pull the screen graph in via the
   `export { default }` specifier line. If either goes wrong, fall back to a
   delegating declaration:
   `export async function loader(request, params) { const { serverAlphaLoader } = await import("@/client/features/server-alpha/loaders"); return serverAlphaLoader(request, params); }`
2. Add a source guard so the skipped syntax can't return: a small jest test
   (e.g. `server/__tests__/loaderExportShape.test.js` or alongside the
   server-alpha tests) that scans `app/**/*.tsx` for any export **specifier**
   named or aliased `loader` (both `export { x as loader }` and
   `export { loader } from …` are skipped by the plugin — match something
   like `export\s*\{[^}]*\bloader\b[^}]*\}`) and fails with a message
   explaining the plugin limitation. Follow the repo's existing source-scan
   test style (`authComponentsSplitPoint.test.ts`).
3. Rewrite the stale comments: `client/features/server-alpha/loaders.ts`
   header (per-request under SSR; param'd routes still fetch API routes
   because loader requests match the route file path) and the
   `ServerAlphaExampleScreen.test.tsx` header premise.
4. Docs: in `docs/server-guide.md`, replace the "Production detection gap"
   paragraph with the corrected convention — declare `loader` in the route
   file (`export const loader = …` or `export function loader…`); keep one
   sentence warning that specifier re-exports are silently dropped by the
   export. Update the route-file sample at `:294` and its `:299–300` caveat.
   In `docs/migration-guide.md`, fix the Phase 3 sample (`:149`) and its
   surrounding convention text the same way.
5. `bun run docs:llms` and commit the regenerated files.

## Validation
- `bun run build`, then:
  - `dist/server/_expo/routes.json` has a `loader` entry for the
    server-alpha route (`python3 -c` or `jq` over `htmlRoutes`).
  - `PORT=3106 bun ./server.bun.ts`: `curl -s localhost:3106/_expo/loaders/server-alpha`
    returns 200 with the catalog JSON (not 404);
    `curl -s -H "Cookie: has-seen-onboarding=1" localhost:3106/server-alpha`
    returns 200 and the server log shows no `fetch() URL is invalid`. Kill
    the server after.
- `bunx jest client/features/server-alpha server scripts` green, including
  the new guard test (confirm it fails when pointed at the old syntax before
  fixing the route file).
- `bun run typecheck && bun run lint && bun run check:features`
- `bun run bundle-size` against the fresh build stays within budget.
- `bun run docs:llms:check` passes;
  `grep -rn "detection gap" docs/` returns nothing.

## Out of scope
- Upstreaming specifier support to `babel-preset-expo` (worth filing with
  Expo separately; this spec fixes the template's own convention).
- `server-alpha/[example].tsx` stays loader-less by design.
- Any change to loader semantics, middleware, or SSR machinery.
