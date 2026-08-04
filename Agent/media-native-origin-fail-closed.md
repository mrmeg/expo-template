---
status: draft
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
- `Config.apiUrl` exists (`EXPO_PUBLIC_API_URL`) but **the media client never consumes it** — only the unrelated `apiClient` does (`client/lib/api/apiClient.ts:17`). Dev default is `http://localhost:3000/api` (`config.dev.ts:10`); **prod falls back to the placeholder `https://api.example.com`** (`config.prod.ts:10`) — the placeholder must count as *unconfigured* for the fail-closed gate, not as an origin to fetch.
- The `disabled` state today is only minted from a server 503 + `code: "media-disabled"` (`packages/media/src/errors.ts:41-51`; screen mapping `app/(main)/(tabs)/media.tsx:222`, disabled UI at 685-697, error UI at 717-731) — i.e. the client must reach a server to learn media is off. When fetch itself throws, it lands in `fetchError` → `media-error`.
- Fail-closed precedents to mirror: auth `getAuthProvider()`/`isAuthEnabled()` (`client/features/auth/provider/index.ts:32-56`, `client/features/app/isAuthEnabled.ts`), billing `Config.billingEnabled` (`config.base.ts:79`), Sentry DSN no-op (`client/lib/sentry.ts:12-15`).
- Keep the packages/media package generic: it's published standalone. Origin/gating logic belongs in the app layer (`client/features/media/`), not the package — the package already accepts any `basePath`/`fetcher`.
- Web behavior must not change: relative `/api/media` on web is correct (same-origin SSR server) and the server's own 503 disabled-path (`app/api/media/__tests__/mediaDisabled.test.ts`) stays authoritative there.
- Existing tests: `client/features/media/lib/__tests__/problem.test.ts` (503→disabled mapping), `client/features/media/__tests__/mediaSettings.test.ts`. No tests cover `useMediaList` or screen states; new ones go in `client/features/media/__tests__/`.

## Work

1. Add a media-origin resolver in `client/features/media/` (e.g. `resolveMediaBasePath()`): web → keep relative `/api/media`; native with a real configured `EXPO_PUBLIC_API_URL` → absolute base derived from it (strip a trailing `/api` segment correctly so the result is `<origin>/api/media` exactly once — note dev default already ends in `/api`); native with unset/placeholder value → signal "unconfigured". Treat the `api.example.com` placeholder as unconfigured; read the actual fallback semantics in `config.prod.ts`/`config.base.ts` rather than string-matching blindly.
2. Fail closed without a network call when unconfigured on native: gate at the screen/hook boundary in the app layer — either disable the query and derive the `mediaDisabled` UI state directly, or synthesize the same `disabled`-kind error the 503 path produces. Pick whichever keeps `app/(main)/(tabs)/media.tsx:222`'s existing state derivation intact; do not fork the screen's state logic.
3. Tests in `client/features/media/__tests__/`: origin resolution (web relative; native with URL → absolute; native dev default; native placeholder/blank → unconfigured), and the no-fetch disabled gating (assert the fetcher is never called when unconfigured).
4. Update `.env.example`'s `EXPO_PUBLIC_API_URL` comment to state the native requirement (absolute origin needed for media on native; blank keeps media disabled).

## Validation

- `bun run verify` passes.
- iOS simulator with blank `.env`: Media tab renders the `media-disabled` UI (`testID="media-disabled"`) with no network request (confirm no "Invalid URL" in Metro logs).
- iOS simulator with `EXPO_PUBLIC_API_URL=http://localhost:3000/api` and the local server running (`bun run build && bun run start`): Media tab reaches the server (expect the server's real 503-disabled response with blank R2 env — the `media-disabled` UI again, but via the network path this time).
- Web: `bun run build && bun run start`, browse `/media` — behavior unchanged (server-reported disabled state).

## Out of scope

- Real R2/media-configured end-to-end upload tests (need secrets).
- Changing `packages/media`'s client API or the server handlers.
- The Maestro `tabs.yml` regex (`media-(disabled|error|auth-required)`) already accepts the new state — tightening it to `media-disabled` is optional; do it only if the flow still passes on the release build.

## Open questions

- None.
