# Spec: Environment Validation & Config Fixes

**Status:** Draft
**Priority:** High
**Scope:** Client + Server

## What

Create an environment variable validation utility that fails fast at startup with clear errors instead of crashing at runtime. Fix the placeholder production API URL. Fix stale README version numbers.

## Why

Missing env vars cause cryptic runtime crashes. The production API URL is literally `"https://api.example.com"`. The README claims Expo SDK 54 / React Native 0.81 but the actual package.json has Expo SDK 55 / React Native 0.83.2 / React 19.2.0.

## Current State

### Config system (`client/config/`)

- `config.base.ts` defines `ConfigBaseProps` interface with `apiUrl: string` and `apiTimeout: number` (default 10000). The base `apiUrl` defaults to empty string `""`.
- `config.dev.ts` overrides `apiUrl` to `"http://localhost:3000/api"`.
- `config.prod.ts` overrides `apiUrl` to `"https://api.example.com"` -- a placeholder that was never replaced.
- `index.ts` merges base + environment config via `__DEV__` check: `const EnvironmentConfig = __DEV__ ? DevConfig : ProdConfig;`.
- No validation occurs at startup. If a consumer reads `Config.apiUrl` in production they get the example.com placeholder silently.

### Auth config (`client/features/auth/config.ts`)

- `ensureAmplifyConfigured()` uses `process.env.EXPO_PUBLIC_USER_POOL_ID!` and `process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!` with non-null assertions.
- If these env vars are missing, Amplify receives `undefined` and fails with an opaque Cognito error at auth time, not at startup.

### API routes (`app/api/media/`)

- Four API route files (`getUploadUrl+api.ts`, `delete+api.ts`, `list+api.ts`, `getSignedUrls+api.ts`) all use `process.env.R2_JURISDICTION_SPECIFIC_URL`, `process.env.R2_ACCESS_KEY_ID!`, `process.env.R2_SECRET_ACCESS_KEY!`, and `process.env.R2_BUCKET` with non-null assertions.
- The S3Client is constructed at module scope so a missing env var causes a crash on the first request, not at startup, and the error message comes from the AWS SDK rather than a clear "missing R2_ACCESS_KEY_ID" message.

### Express server (`server/index.ts`)

- Reads `process.env.ALLOWED_ORIGINS` (optional, defaults to localhost) and `process.env.PORT` (optional, defaults to 3000).
- No validation; these are fine as-is since they have sensible defaults.

### README.md

- Line 232: `"Expo SDK 54"` -- actual is SDK 55 (`expo: ~55.0.6`).
- Line 233: `"React Native 0.81"` -- actual is 0.83.2.
- React 19.2.0 is not mentioned anywhere in the tech stack section.

## Changes

### 1. Create `client/lib/validateEnv.ts`

A startup utility that checks required environment variables and throws a clear, aggregated error message listing all missing vars at once.

```ts
interface EnvRule {
  key: string;
  required: boolean;
  context: string; // e.g. "Auth (Cognito)", "Media (R2)"
}
```

- Define separate rule sets: `CLIENT_ENV_RULES` for client-side vars (`EXPO_PUBLIC_*`) and `SERVER_ENV_RULES` for server-side vars (`R2_*`).
- Export `validateClientEnv()` and `validateServerEnv()` functions.
- Each function checks all rules, collects missing required vars, and throws a single error: `"Missing required environment variables:\n - EXPO_PUBLIC_USER_POOL_ID (Auth)\n - EXPO_PUBLIC_USER_POOL_CLIENT_ID (Auth)"`.
- In `__DEV__`, log a warning instead of throwing (devs may not have all services configured).
- In production, throw to prevent startup with broken config.

### 2. Call `validateClientEnv()` at app startup

In `app/_layout.tsx`, call `validateClientEnv()` early (before the QueryClient instantiation). This catches missing client-side env vars immediately.

### 3. Call `validateServerEnv()` in API routes

Add a `validateServerEnv()` call at the top of `server/index.ts`. For API routes (which are Expo Router API routes, not Express middleware), add validation at the module level in a shared helper that each route imports, so the error surfaces on first route load rather than buried inside an S3 call.

### 4. Fix production API URL

Change `config.prod.ts` to read from `process.env.EXPO_PUBLIC_API_URL` with a fallback to the current placeholder, and add `EXPO_PUBLIC_API_URL` to the client env rules as required in production.

```ts
const ProdConfig: Partial<ConfigBaseProps> = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://api.example.com",
  // ...
};
```

### 5. Fix auth config

Update `client/features/auth/config.ts` to validate the two Cognito env vars before passing them to Amplify, with a clear error message.

### 6. Fix README version numbers

- Line 232: Change `"Expo SDK 54"` to `"Expo SDK 55"`.
- Line 233: Change `"React Native 0.81"` to `"React Native 0.83"`.
- Add `"React 19"` to the tech stack list.

## Acceptance Criteria

- [ ] App throws a clear, human-readable error listing all missing env vars when required vars are absent in production builds.
- [ ] In development, missing env vars produce console warnings but do not crash.
- [ ] Production config reads `EXPO_PUBLIC_API_URL` from the environment instead of hardcoding a placeholder.
- [ ] Auth config validates Cognito env vars before calling `Amplify.configure()`.
- [ ] API routes surface missing R2 env vars with clear messages instead of opaque AWS SDK errors.
- [ ] README shows correct versions: Expo SDK 55, React Native 0.83, React 19.
- [ ] Existing tests still pass (`jest --watchAll` does not regress).
- [ ] No new runtime warnings in development when all env vars are present.

## Constraints

- Keep the validation utility minimal -- no new dependencies.
- Do not change the config merging strategy (`__DEV__` ternary in `index.ts`).
- Do not change the `ConfigBaseProps` interface shape.
- Validation must work on all three platforms (iOS, Android, Web).
- Use `process.env.EXPO_PUBLIC_*` for client-side vars (Expo convention).

## Out of Scope

- `.env.example` file or dotenv integration (already exists via `start-local` script).
- Schema validation of env var values (e.g., checking URL format).
- Secrets management or vault integration.
- Changing the dual-config (dev/prod) architecture.
- Env var validation for the generator CLI (`scripts/generate.ts`).

## Files Likely Affected

- `client/lib/validateEnv.ts` (new)
- `client/config/config.prod.ts`
- `client/features/auth/config.ts`
- `app/_layout.tsx`
- `server/index.ts`
- `app/api/media/getUploadUrl+api.ts`
- `app/api/media/delete+api.ts`
- `app/api/media/list+api.ts`
- `app/api/media/getSignedUrls+api.ts`
- `README.md`

## Edge Cases

- **Developer with partial env setup:** In dev mode, a developer may only have Cognito configured but not R2. Warnings should be contextual (e.g., "Media features require R2_ACCESS_KEY_ID") not blocking.
- **Web vs. native env access:** `process.env.EXPO_PUBLIC_*` is inlined at build time by Metro/Expo. Ensure validation runs after bundling resolves these values, not against literal `process.env` strings.
- **CI/CD builds:** Validation must not break CI if env vars are intentionally absent (e.g., lint-only CI jobs). Consider gating server-side validation behind an actual server startup context.
- **Empty string vs. undefined:** An env var set to `""` should be treated as missing. Check for both `undefined` and empty string.
- **Config.apiUrl already consumed:** The `Api` class constructor in `apiClient.ts` reads `Config.apiUrl` at instantiation. Validation must run before the singleton `api` export is first imported.
