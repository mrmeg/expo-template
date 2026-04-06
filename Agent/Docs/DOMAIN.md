# Domain Model

> Business entities, rules, and invariants.

## Overview

This is an **Expo app template** — a starter kit for building cross-platform apps. The domain is intentionally generic, providing foundational capabilities that concrete apps build upon.

## Core Entities

### User (Auth)

Managed by AWS Cognito via Amplify.

| Property | Type | Source |
|----------|------|--------|
| userId | string | Cognito sub |
| email | string | Cognito attribute |
| authState | `loading \| authenticated \| unauthenticated` | authStore |
| session tokens | JWT | Amplify fetchAuthSession() |

**Invariants:**
- Auth state is determined by Amplify Hub listener (singleton init pattern)
- State transitions throttled to 2-second minimum to prevent auth loops
- Tokens auto-refreshed by Amplify SDK
- `authStore` must be initialized once before any auth-dependent UI renders

### Media

Files stored in S3/R2 with presigned URL access.

| Property | Type | Notes |
|----------|------|-------|
| key | string | S3 object key (e.g., `uploads/01HXYZ.jpg`) |
| mediaType | MediaType | `avatars \| videos \| thumbnails \| uploads` |
| size | number | File size in bytes |
| lastModified | Date | S3 metadata |

**Invariants:**
- Upload URLs expire in 5 minutes
- Read URLs expire in 24 hours
- Batch delete maximum: 1000 keys per request
- Video thumbnails derive path from video key (`videos/x.mp4` → `thumbnails/x.jpg`)
- Image compression happens client-side before upload (HEIC → JPEG conversion on iOS)

**Media Paths** (from `shared/media.ts`):
| Path | Prefix | Purpose |
|------|--------|---------|
| avatars | `users/avatars` | User profile images |
| videos | `videos` | Video uploads |
| thumbnails | `thumbnails` | Auto-generated video thumbnails |
| uploads | `uploads` | General file uploads |

### Theme Preference

| Property | Type | Notes |
|----------|------|-------|
| mode | `system \| light \| dark` | User preference |
| resolved | `light \| dark` | Actual applied theme |

**Invariants:**
- Persisted to AsyncStorage (native) / localStorage (web)
- `system` mode follows OS preference
- Web: `html[data-theme]` attribute synced for CSS

### Language Preference

| Property | Type | Notes |
|----------|------|-------|
| language | `en \| es` | Currently supported |
| isRTL | boolean | Derived from language |

**Invariants:**
- Default language detected from device locale
- Translations lazy-loaded (only English bundled by default)
- RTL layout forced via `I18nManager.forceRTL()` when applicable

### Onboarding State

| Property | Type | Notes |
|----------|------|-------|
| completed | boolean | Persisted |

**Invariants:**
- Once completed, never shown again (unless store is reset)
- Persisted to AsyncStorage/localStorage

### Compression Settings

| Property | Type | Notes |
|----------|------|-------|
| quality | number | Image compression quality |
| maxWidth | number | Max resize width |
| maxHeight | number | Max resize height |

**Invariants:**
- Presets available for different use cases
- Applied client-side before upload

## Business Rules

### Feature Isolation
- Features never import from other features — only from the shared layer
- Exception: media → notifications (globalUIStore) for upload toast feedback
- This rule enables features to be added/removed independently

### API Error Handling
- All API calls return discriminated unions (never throw)
- Error types: `timeout`, `unauthorized`, `forbidden`, `not-found`, `bad-data`, `network-error`, `server-error`, `unknown`
- 401/403/404 errors are NOT retried
- Other errors retry twice with exponential backoff

### Rate Limiting
- General API: 500 requests / 15 minutes
- Sensitive endpoints (upload URL, reports): 10 requests / 1 minute

### Cross-Platform Storage
- All persisted state MUST use platform-aware storage
- Native: AsyncStorage
- Web: localStorage
- Stores abstract this via `Platform.OS` checks
