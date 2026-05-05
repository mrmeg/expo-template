# Night Shift Report — 2026-05-04

## Completed

### Isolate Media List Prefixes
**Commits:** `be45860 fix(media): scope list requests to configured prefixes`, `ea209c7 chore(agent): complete isolate media list prefixes`
**What changed:** `@mrmeg/expo-media` no longer allows unscoped bucket-root listing. List requests now require `mediaType` or a valid configured prefix, and the template Media tab's All filter aggregates fixed configured media-type queries client-side.

**How to verify:**
1. Run `bun run media:test` and confirm `createMediaHandlers list` covers `mediaType=uploads`, unscoped list rejection, unknown-prefix rejection, cross-media-type rejection, and narrower-prefix success.
2. Open the Media tab with storage configured and verify All still shows files from avatars, videos, thumbnails, and uploads without sending `/api/media/list` without `mediaType`.
3. Check web, iOS, and Android Media tab browsing behavior.

---

### Group Media Batch Delete By Bucket
**Commits:** `382ebd1 fix(media): group batch deletes by bucket`, `a63f95a chore(agent): complete group media batch delete by bucket`
**What changed:** Batch delete now resolves every key to its media type, groups keys by the configured physical bucket, sends one delete command per bucket, and merges confirmed deletions plus per-key errors. Policy is still called once with the full resolved key list before storage mutation.

**How to verify:**
1. Run `bun run media:test` and confirm mixed-bucket and one-bucket delete tests pass.
2. Run `bunx jest --config jest.config.js app/api/media/__tests__/delete.test.ts --runInBand --watchman=false`.
3. In a multi-bucket consumer config, delete selected media spanning two buckets and verify each bucket receives only its own keys.

---

### Require Auth Policy For Template Media Routes
**Commits:** `3c5bced fix(media): require auth for configured media routes`, `3e4ec5b chore(agent): complete require auth policy for media routes`
**What changed:** Template media routes now require authenticated users for upload, list, signed-read, and delete when real storage is configured. `media-disabled` still returns before auth when storage env vars are missing, and `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA=true` is an explicit local/demo bypass ignored in production. The Media tab renders a dedicated auth/access state for 401/403 media errors.

**How to verify:**
1. Run `bunx jest --config jest.config.js app/api/media/__tests__ --runInBand --watchman=false`.
2. With all `R2_*` vars set and no auth token, call upload/list/getSignedUrls/delete routes and expect 401.
3. Set `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA=true` outside production and verify local media routes are accessible; set `NODE_ENV=production` and verify the bypass is ignored.

---

### Use Named Media Upload Policies
**Commits:** `612ae52 refactor(media): use named upload policies`, `afcba22 chore(agent): complete use named media upload policies`
**What changed:** The Media tab now resolves uploads through `MEDIA_APP_SETTINGS.uploadPolicies` instead of inline media-type branching. The default All flow uses `generalImage` for images and `video` for videos; avatar-filter image uploads use `avatar`; normal user-selected files are not redirected into generated thumbnails.

**How to verify:**
1. Run `bunx jest --config jest.config.js client/features/media/__tests__/mediaSettings.test.ts --runInBand --watchman=false`.
2. Upload an image from All and verify it uses the uploads media type with gallery compression.
3. Upload a video from All and verify it uses the videos media type and still uploads a generated thumbnail derivative.

---

## Blocked

### Publish Expo Media 0.1.1
**Reason:** Registry credential setup is blocked. `npm view @mrmeg/expo-media version dist-tags --json` still reports `0.1.0`, while `packages/media/package.json` and `bun.lock` agree on `0.1.1`. GitHub Actions run `25345952685` passed install, version availability, lockfile update, media typecheck, media tests, build, pack dry run, and consumer smoke, then failed at `npm publish` with `ENEEDAUTH`. `gh secret list --repo mrmeg/expo-template` showed no `NPM_TOKEN`, and `npm trust list @mrmeg/expo-media --json` requires interactive one-time-password/browser authentication.
**What's needed:** Configure npm trusted publishing for owner `mrmeg`, repository `expo-template`, workflow `publish-media.yml`, or add a GitHub `NPM_TOKEN` secret with publish access, then rerun `publish-media.yml` with `version=0.1.1` and `ref=main`.

## Issues Discovered

- The Mac was on battery with Low Power Mode enabled (`pmset -g batt`: Battery Power, discharging; `pmset -g custom`: `lowpowermode 1`). Full app builds, bundle-size checks, package pack/smoke, and full `bun run test:ci` were skipped to conserve power.
- `bun run lint` exits 0 but still reports 15 pre-existing warnings in demo/profile/settings files.
- Commands to run later on AC power: `bun run test:ci`, `bun run build`, `bun run bundle-size`, `bun run media:build`, `bun run media:pack`, `bun run media:consumer-smoke`.

## Docs Updated

- `Agent/Docs/API.md` — scoped list contract and partial batch-delete semantics.
- `Agent/Docs/ARCHITECTURE.md` — configured media storage auth posture and public-media dev bypass.
- `Agent/Docs/DOMAIN.md` — media list and batch-delete invariants.
- `Agent/Docs/EXPO_MEDIA_PACKAGE.md` — scoped list, route auth customization, batch delete, and all-view pagination notes.
- `Agent/Docs/USER_FLOWS.md` — Media tab auth/access state and safe all-media listing flow.
- `packages/media/README.md` — shipped scoped-list and batch-delete package guidance.
- `.env.example` and `README.md` — `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA` behavior.
- `Agent/AGENTS.md` — completed specs removed; blocked publish spec remains.
- `Agent/CHANGELOG.md` — user-facing entries and publish credential blocker.
