---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Media: absolute API origin on native + fail-closed disabled state

## Goal

Fix two related media bugs found during release smoke tests: (1) on native the media client can never work — it fetches a **relative** URL (`/api/media/list?...`), which web tolerates (page origin) but native `fetch` rejects with `TypeError: Invalid URL`; (2) with a blank `.env` the Media tab shows the raw `media-error` state instead of `media-disabled`, violating the AGENTS.md fail-closed rule (line 51). After this spec: native uses an absolute origin when one is configured, and shows the disabled state with **no network call** when none is.

## Context

- URL chain: `client/features/media/mediaClient.ts:24-27` builds `createMediaClient({ basePath: "/api/media", ... })`; `packages/media/src/client/index.ts:81-82` (`endpoint()`) just concatenates; the TypeError surfaces from native fetch inside `list()` (`index.ts:142-154`) via `client/lib/api/authenticatedFetch.ts:55` (rethrown at 69).
- `Config.apiUrl` exists but **the media client never consumes it** — only the unrelated `apiClient` does (`client/lib/api/apiClient.ts:17`). **Do not derive the gate from `Config.apiUrl`**: its semantics make that impossible. `client/config/index.ts` picks `config.dev.ts` when `__DEV__` else `config.prod.ts`, so `Config.apiUrl` is:
  - dev → hardcoded `"http://localhost:3000/api"`, **ignoring `EXPO_PUBLIC_API_URL` entirely** (`config.dev.ts:10`) → a blank `.env` would still look "configured", breaking the fail-closed gate;
  - prod → `process.env.EXPO_PUBLIC_API_URL || "https://api.example.com"` (`config.prod.ts:10`) → blank env looks configured too, pointing at a placeholder;
  - `config.base.ts:76` `apiUrl: ""` is only the pre-merge default and never survives the merge.
  So the resolver must read `process.env.EXPO_PUBLIC_API_URL` directly (static property access — Expo only inlines those; mirror the comment in `client/features/auth/provider/index.ts:33-35`) and treat blank/whitespace-only as unconfigured. Also treat `https://api.example.com` as unconfigured for defense in depth. Consequence to accept and document: on native, media no longer piggybacks on the dev `localhost:3000` default — `EXPO_PUBLIC_API_URL` must be set explicitly.
- `EXPO_PUBLIC_API_URL` is deliberately unvalidated by `client/lib/validateEnv.ts:71-73` — leave that alone; the media gate is the enforcement point.
- The `disabled` state today is only minted from a server 503 + `code: "media-disabled"` (`packages/media/src/errors.ts:41-51`; screen mapping `app/(main)/(tabs)/media.tsx:222`, disabled UI at 685-697, error UI at 717-731) — i.e. the client must reach a server to learn media is off. When fetch itself throws, it lands in `fetchError` (line 229) → `media-error`.
- Gating at the app layer is feasible with the existing hook API: `useMediaList` already accepts `enabled` (`packages/media/src/react-query/index.ts:26-28,49-62`), as does `useSignedMediaUrls` (30-34). The screen already passes `enabled` per filter (`media.tsx:122-137`, `531-535`, `547-551`), so an extra `&& !unconfigured` conjunct is the minimal change. The app's hooks are thin re-exports (`client/features/media/hooks/useMediaList.ts` etc.) — either add the conjunct at each call site in `media.tsx`, or wrap in the app hook; do not touch the package.
- With every query disabled, `error` stays `null`, so `mediaDisabled` (line 222) is `false` and the screen would fall through to the empty state. Line 222 must therefore become `unconfigured || (isMediaError(error) && …)`, or `error` must be replaced by a synthesized `new MediaError({ kind: "disabled", missing: ["EXPO_PUBLIC_API_URL"] })`. The synthesized-error route is preferable: `missingEnvVars` (line 228) then renders the missing var, and `uploadDisabled` (line 263) and the branch order at 685+ keep working untouched. `MediaError` is re-exported through `client/features/media/lib/problem.ts`.
- Fail-closed precedents to mirror: auth `getAuthProvider()`/`isAuthEnabled()` (`client/features/auth/provider/index.ts:32-56`, `client/features/app/isAuthEnabled.ts`), billing `Config.billingEnabled` (`config.base.ts:79`), Sentry DSN no-op (`client/lib/sentry.ts:12-15`).
- Keep the packages/media package generic: it's published standalone. Origin/gating logic belongs in the app layer (`client/features/media/`), not the package — the package already accepts any `basePath`/`fetcher`.
- Web behavior must not change: relative `/api/media` on web is correct (same-origin SSR server) and the server's own 503 disabled-path (`app/api/media/__tests__/mediaDisabled.test.ts`) stays authoritative there.
- Existing tests: `client/features/media/lib/__tests__/problem.test.ts` (503→disabled mapping), `client/features/media/__tests__/mediaSettings.test.ts`. No tests cover `useMediaList` or screen states; new ones go in `client/features/media/__tests__/`.

## Work

1. Add a pure media-origin resolver in `client/features/media/` (e.g. `mediaOrigin.ts` exporting `resolveMediaBasePath()`), reading `process.env.EXPO_PUBLIC_API_URL` directly per the Context note. Behavior: web (`Platform.OS === "web"`) → relative `/api/media`; native + configured absolute URL → `<origin>/api/media` exactly once (the value may or may not already end in `/api`, so normalize: strip trailing slashes, strip one trailing `/api`, then append `/api/media`); native + blank/whitespace/placeholder → `unconfigured`. Return a discriminated result (e.g. `{ configured: true; basePath } | { configured: false }`) so callers can't confuse "" with a real base path. Keep it env-only — no `@/client/config` import, since `check:features` gives `media` no allowed cross-feature deps.
2. Feed the resolved base path into `createMediaClient({ basePath })` in `client/features/media/mediaClient.ts:24-27` and export the unconfigured flag alongside it.
3. Fail closed without a network call when unconfigured on native: in `app/(main)/(tabs)/media.tsx`, add the flag as an extra `&& !unconfigured` conjunct to each `useMediaList`/`useSignedUrls` `enabled`, and synthesize `new MediaError({ kind: "disabled", missing: ["EXPO_PUBLIC_API_URL"] })` in place of `error` so lines 222/228/229/263 and the 685+ branch order keep working unchanged. Do not fork the screen's state logic.
4. Tests in `client/features/media/__tests__/`: resolver unit tests (web → relative; native + `https://x.dev` → `https://x.dev/api/media`; native + `https://x.dev/api` → `https://x.dev/api/media`, not `/api/api/media`; native + trailing slash; native + blank/whitespace/`https://api.example.com` → unconfigured). Mock `react-native`'s `Platform.OS` and set `process.env.EXPO_PUBLIC_API_URL` per case with `jest.resetModules()` + `await import()`, since the resolver reads env at module scope if you cache it (prefer computing per call to keep tests simple). Plus a screen-level or hook-level assertion that no fetch happens when unconfigured (mock `mediaClient`'s fetcher / `client.list` and assert zero calls).
5. Fix `.maestro/tabs.yml`'s comment at lines 11-16, which asserts a native blank-env build "can't even form the request URL, so it lands on `media-error`" — false after this change (it now lands on `media-disabled`). Leave the assertion regex itself alone.
6. Update `.env.example:22-25`'s `EXPO_PUBLIC_API_URL` comment: on native, media requires an absolute origin here (the dev `localhost:3000` default in `config.dev.ts` does not apply to media); blank keeps the Media tab in its disabled state.

## Validation

- `bun run verify` passes (gates: `packages:peer-check`, `typecheck`, `lint`, `check:features`, `gen:templates:check`, `docs:llms:check`, `docs:versions:check`, `jest --ci`).
- iOS simulator with blank `.env`: Media tab renders the `media-disabled` UI (`testID="media-disabled"`) with no network request (confirm no "Invalid URL" in Metro logs).
- iOS simulator with `EXPO_PUBLIC_API_URL=http://localhost:3000/api` and the local server running (`bun run build && bun run start-local` — `start-local` is the variant that loads `.env`): Media tab reaches the server (expect the server's real 503-disabled response with blank R2 env — the `media-disabled` UI again, but via the network path this time).
- Web: `bun run build && bun run start-local`, browse `/media` — behavior unchanged (server-reported disabled state).

## Out of scope

- Real R2/media-configured end-to-end upload tests (need secrets).
- Changing `packages/media`'s client API or the server handlers.
- Tightening the Maestro `tabs.yml` assertion id (`media-(disabled|error|auth-required)`, line 39) to `media-disabled` — the existing regex already accepts the new state.

## Open questions

- None.
