# Night Shift Report — 2026-03-30/31

## Completed

### 1. Env Validation & Config Fixes
**Commits:** `f8bf6a7`
**What changed:** Created env validation utility that fails fast with clear error listing all missing vars. Fixed placeholder production API URL to read from EXPO_PUBLIC_API_URL. Fixed auth config to validate Cognito vars before Amplify.configure(). Fixed README version numbers (SDK 54→55, RN 0.81→0.83).

**How to verify:**
1. Remove EXPO_PUBLIC_USER_POOL_ID from .env — dev: console warning, prod: throws
2. Check config.prod.ts reads EXPO_PUBLIC_API_URL from env
3. Check README.md shows correct versions

---

### 2. Server Security Hardening
**Commits:** `5e38552`
**What changed:** Added security headers to Express (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS in prod, X-Request-ID). Replaced wildcard CORS in all 4 API routes with shared cors.ts utility that validates Origin against ALLOWED_ORIGINS. Sanitized error responses (details only in dev).

**How to verify:**
1. Start server, inspect response headers — security headers present
2. Check API route responses no longer have Access-Control-Allow-Origin: *
3. 500 error responses in production omit details field

---

### 3. API Client Improvements
**Commits:** `588f15c`
**What changed:** Added retry with exponential backoff to apiClient (GET defaults to 2 retries, mutations 0). Added 30s timeout to authenticatedFetch. Configured React Query: staleTime 5min, gcTime 10min, smart retry (skip 4xx), refetchOnWindowFocus disabled.

**How to verify:**
1. api.get() retries on 503 — check with network throttling
2. React Query doesn't refetch on every navigation anymore
3. authenticatedFetch times out after 30s by default

---

### 4. Font Loading Resilience
**Commits:** `c1e9ad6`
**What changed:** Added 5-second timeout to font loading. App proceeds with system fallback fonts instead of blocking on splash screen forever.

**How to verify:**
1. Font loading timeout fires after 5s on slow/failed load
2. Normal font loading still works within 5s

---

### 5. DX Documentation
**Commits:** `eb74020`
**What changed:** Added .vscode/settings.json (2-space indent, format on save, ESLint auto-fix), .vscode/extensions.json (5 recommended extensions), CONTRIBUTING.md (getting started, code style, git workflow, PR checklist, testing, scaffolding).

**How to verify:**
1. Open project in VSCode — extension recommendations appear
2. CONTRIBUTING.md is clear and complete
3. README references CONTRIBUTING.md and .vscode

---

### 6. CI/CD Pipeline
**Commits:** `e19d2c8`
**What changed:** Created .github/workflows/ci.yml (bun install, tsc, lint, jest on PRs/pushes to main/dev). Added typecheck and test:ci scripts to package.json. Created docs/ci-cd.md with pipeline docs and EAS Build extension guide.

**How to verify:**
1. Push to dev or open a PR — CI runs
2. `bun run typecheck` and `bun run test:ci` work locally

---

### 7. New Component Showcases
**Commits:** `56e2801`
**What changed:** Added 7 showcase sections for Dialog, Tabs, Select, RadioGroup, Progress, Slider, InputOTP with interactive demos. Updated badge from "27 components" to "35 components".

**How to verify:**
1. Open showcase screen — scroll to new sections
2. Dialog opens/closes, Tabs switch, Select picks values
3. Badge count shows "35 components"

---

### 8. New Screen Demos
**Commits:** `f226bad`
**What changed:** Created 7 demo routes (screen-card-grid, screen-chat, screen-dashboard, screen-error, screen-form, screen-notifications, screen-search). Updated Explore tab from 5 to 13 screen templates. Registered all routes in layout.

**How to verify:**
1. Explore tab shows 13 screen templates in the grid
2. Each demo loads with sample data and is interactive
3. Chat demo sends messages, Form demo validates, Error cycles variants

---

### 9. Web SEO Meta Tags
**Commits:** `6827136`
**What changed:** Created SEO component (web-only, renders title + OG + Twitter Card tags). Added to all 4 tab screens. Default title/description in +html.tsx.

**How to verify:**
1. Run web, view page source — meta tags present
2. Browser tabs show correct titles
3. Native: no errors, SEO renders nothing

---

### 10. Bundle Size Analysis
**Commits:** `487538b`
**What changed:** Created scripts/check-bundle-size.js (compares dist/ against baseline, exits 1 if >10% growth). Added analyze and bundle-size scripts. Documented workflow in docs/bundle-analysis.md.

**How to verify:**
1. `bun run build && bun run bundle-size` — reports size
2. `bun run bundle-size --update` — sets baseline
3. Intentionally increase size >10% — check fails

---

### 11. Error Tracking (Sentry)
**Commits:** `006a7a2`
**What changed:** Integrated @sentry/react-native with zero-impact when no DSN configured. setupSentry() at startup, ErrorBoundary sends to Sentry, sentryDsn in config. Documented in docs/error-tracking.md.

**How to verify:**
1. Without DSN: app works identically, "Sentry disabled" in dev console
2. With DSN: errors captured in Sentry dashboard
3. ErrorBoundary crashes include component stack in Sentry

---

### 12. Partial: Core Test Coverage
**Commits:** `0ff94b4`
**What changed:** Added apiProblem.test.ts (15 tests) and retry.test.ts (4 tests). Total: 98 tests (was 71).

**How to verify:**
1. `npx jest` — 98 tests passing

---

## Remaining (Not Completed)

### Core Test Coverage (partial)
**Reason:** The spec covers 8 test files (authStore, apiClient, useTheme, form adapters, useScalePress, useStaggeredEntrance). Only apiProblem and retry tests were completed. The remaining tests (authStore state machine, full apiClient with mocked fetch, useTheme color math) are substantial and require dedicated focus.
**What's needed:** Continue writing tests for authStore, apiClient, and useTheme in the next session.

### Screen Template Tests
**Reason:** Not started. Spec covers FormScreen, ChatScreen, and DashboardScreen integration tests.
**What's needed:** Implement in next session alongside remaining core test coverage.

## Issues Discovered

- ESLint has a pre-existing minimatch import error (unrelated to shift work)
- Sentry blocked a postinstall script (bun security feature) — no impact on functionality

## Docs Updated

- Agent/Docs/ARCHITECTURE.md — updated in previous shift (component/screen counts)
- docs/ci-cd.md — new (pipeline documentation)
- docs/error-tracking.md — new (Sentry setup guide)
- docs/bundle-analysis.md — new (bundle size workflow)
- CONTRIBUTING.md — new (developer onboarding)
- README.md — fixed versions, added IDE Setup and Contributing sections
