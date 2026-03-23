# Domain Model

> Business entities, rules, and invariants.

---

## Core Entities

### User (Auth)

Managed by AWS Cognito. The app does not store user data locally beyond auth tokens.

**States:**
```
loading → authenticated | unauthenticated
```

**Attributes (from Cognito):**
- `userId` — Cognito sub
- `username` — Display name
- `email` — Email address
- `emailVerified` — Boolean
- `plan` — User plan (display only)
- `memberSince` — Account creation date

**Auth Operations:**
| Operation | Flow |
|-----------|------|
| Sign Up | email + password + name → verification code sent |
| Verify Email | code → auto sign-in on success |
| Sign In | email + password → tokens stored |
| Forgot Password | email → reset code sent |
| Reset Password | code + new password → auto sign-in |
| Sign Out | Clear tokens, reset store |

**Invariants:**
- 2-second throttle on auth initialization prevents Hub listener loops
- Singleton init pattern — `initialize()` called once, no-op on subsequent calls
- Token refresh handled automatically by Amplify Hub listener

### Media Object

Files stored in Cloudflare R2 (S3-compatible).

**Attributes:**
- `key` — Full S3 path (e.g., `uploads/01HQXYZ.jpg`)
- `lastModified` — ISO timestamp
- `size` — Bytes
- `etag` — Content hash

**Media Types (paths):**
| Type | Path | Description |
|------|------|-------------|
| Avatars | `users/avatars/` | User profile images |
| Videos | `videos/` | Uploaded videos |
| Thumbnails | `thumbnails/` | Video thumbnail images |
| Uploads | `uploads/` | General file uploads |

**Upload Flow Invariants:**
- Filenames are ULID-based unless custom filename is provided
- Presigned upload URLs expire in 5 minutes
- Presigned download URLs expire in 24 hours
- HEIC images auto-convert to JPEG before upload
- Compression applied based on `compressionStore` presets
- Video uploads can generate thumbnails stored in `thumbnails/`

**Compression Presets:**
| Preset | Quality | Max Width | Max Height | Use Case |
|--------|---------|-----------|------------|----------|
| avatar | 0.7 | 400 | 400 | Profile photos |
| thumbnail | 0.6 | 300 | 300 | List thumbnails |
| product | 0.8 | 1200 | 1200 | Product images |
| gallery | 0.85 | 2048 | 2048 | Gallery display |
| highQuality | 0.95 | 4096 | 4096 | Full resolution |
| none | 1.0 | — | — | No compression |

### Notification

Ephemeral UI state — not persisted.

**Attributes:**
- `type` — info | success | warning | error
- `title` — Header text
- `messages` — Array of message strings
- `duration` — Auto-dismiss time (ms)
- `loading` — Show spinner
- `position` — top | bottom

**Invariant:** Only one notification visible at a time. New `show()` replaces existing.

### Onboarding State

**Attributes:**
- `hasSeenOnboarding` — Boolean, persisted

**Invariant:** Once set to `true`, never resets (unless store is cleared manually).

### Theme Preference

**Attributes:**
- `userTheme` — "system" | "light" | "dark"

**Invariant:** Persisted across sessions. "system" follows device setting.

### Language Preference

**Attributes:**
- `language` — ISO code ("en", "es")

**Invariants:**
- English always available (bundled)
- Other locales lazy-loaded on first use
- RTL configured via `I18nManager.forceRTL()` based on language

### Drawer State

**Attributes:**
- `openDrawers` — `Set<string>` of drawer IDs

**Invariant:** Supports multiple simultaneous drawers via unique IDs.

---

## Cross-Cutting Rules

1. **Feature isolation** — Features never import from other features. Only exception: media imports `globalUIStore` from notifications.

2. **Platform storage abstraction** — All persisted state uses AsyncStorage on native, localStorage on web. Check `Platform.OS` at runtime.

3. **No local user data** — User profile data comes from Cognito attributes. The app has no local user database.

4. **Presigned URL security** — Files are never publicly accessible. All access goes through time-limited presigned URLs.

5. **Offline consideration** — The app does not currently have offline support. Media operations require network connectivity.

<!-- NEEDS HUMAN REVIEW: Is there a user database or profile service beyond Cognito attributes? The current codebase only reads from Cognito, but the profile screen shows fields like "plan" and "status" that may come from an external service. -->
