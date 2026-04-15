# API Reference

> Endpoints, schemas, auth patterns, and error handling.

## API Routes (Expo Router Server)

All routes live under `app/api/` and use the Expo Router `+api.ts` convention.

### Media Endpoints

Base path: `/api/media/`

#### POST `/api/media/getUploadUrl`

Generate a presigned S3 URL for uploading a file.

**Request:**
```json
{
  "extension": "jpg",
  "mediaType": "uploads",
  "customFilename": "my-photo"  // optional
}
```

**Response (200):**
```json
{
  "uploadUrl": "https://s3.../presigned-url",
  "key": "uploads/01HXYZ.jpg",
  "expiresAt": "2024-01-01T00:05:00Z"
}
```

- Upload URL expires in 5 minutes
- Filenames use ULID by default (or `customFilename` if provided)
- `mediaType` must be a valid `MediaPath` from `shared/media.ts`

#### POST `/api/media/getSignedUrls`

Batch-generate presigned read URLs for existing files.

**Request:**
```json
{
  "keys": ["uploads/abc.jpg", "videos/xyz.mp4"],
  "path": "uploads"  // optional prefix filter
}
```

**Response (200):**
```json
{
  "urls": {
    "uploads/abc.jpg": "https://s3.../signed-read-url",
    "videos/xyz.mp4": "https://s3.../signed-read-url"
  }
}
```

- Read URLs expire in 24 hours

#### DELETE `/api/media/delete`

Delete a single file from S3.

**Query:** `?key=uploads/abc.jpg`

**Response (200):**
```json
{ "success": true, "key": "uploads/abc.jpg" }
```

#### POST `/api/media/delete` (batch)

Delete multiple files from S3.

**Request:**
```json
{ "keys": ["uploads/abc.jpg", "uploads/def.png"] }
```

**Response (200):**
```json
{
  "success": true,
  "deleted": ["uploads/abc.jpg", "uploads/def.png"],
  "errors": []
}
```

- Maximum 1000 keys per batch request

#### GET `/api/media/list`

List S3 objects with pagination.

**Query:** `?prefix=uploads&limit=100&cursor=token`

**Response (200):**
```json
{
  "items": [
    { "key": "uploads/abc.jpg", "size": 12345, "lastModified": "..." }
  ],
  "totalCount": 42,
  "nextCursor": "token-or-null"
}
```

### Billing Endpoints (baseline, hosted-external)

Base path: `/api/billing/`. These routes are the default Stripe
subscription surface. See [`BILLING.md`](./BILLING.md) for the full
architecture; implementation lands in later specs.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/billing/summary` | GET | Cognito (authenticatedFetch) | Return normalized `BillingSummary` for the signed-in user |
| `/api/billing/checkout` | POST | Cognito | Create a Stripe Checkout Session; returns `{ url }` for browser handoff |
| `/api/billing/portal` | POST | Cognito | Create a Stripe Billing Portal session; returns `{ url }` |
| `/api/billing/webhook` | POST | Stripe signature (no Cognito) | Receive Stripe events; server-authoritative state writes |

**Normalized summary shape:**

```ts
type BillingSummary = {
  state: "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  plan: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};
```

The summary is keyed to the Cognito `sub`, not email. Raw Stripe IDs
stay server-side; clients never read them.

**Rate limits:** `/api/billing/checkout` and `/api/billing/portal` should
be registered in `STRICT_LIMIT_PATHS` (see Rate Limiting table below)
when the routes land, alongside `/api/media/getUploadUrl`.

**Return URL contract:** hosted sessions redirect to a single return
path (`/billing/return`) with `status=success|cancel|portal`. Web uses
`https://…/billing/return`; native uses `myapp://billing/return` via
`expo-web-browser`'s `openAuthSessionAsync`. Client refetches the
summary on return — the redirect is a UX hint, not proof of payment.

### CORS

All API routes handle OPTIONS preflight. CORS is configured in `app/api/_shared/cors.ts`:

- Allowed origins: configurable via `ALLOWED_ORIGINS` env var
- Defaults: `http://localhost:8081`, `http://localhost:3000`
- Headers: `Content-Type`, `Authorization`
- Methods: `GET`, `POST`, `DELETE`, `OPTIONS` (DELETE is advertised globally so single-file media deletion works cross-origin; individual routes still choose which verbs to implement)
- Preflight cache: 86400 seconds (24 hours)

## Client API Layer

### apiClient (`client/lib/api/apiClient.ts`)

Typed fetch wrapper returning discriminated unions:

```typescript
type ApiResult<T> = ApiOk<T> | ApiProblem;

// Success
{ kind: "ok", data: T }

// Errors
{ kind: "timeout" }
{ kind: "unauthorized" }
{ kind: "forbidden" }
{ kind: "not-found" }
{ kind: "bad-data" }
{ kind: "network-error" }
{ kind: "server-error" }
{ kind: "unknown", temporary: boolean }
```

**Usage:**
```typescript
import { api } from "@/client/lib/api";

const result = await api.get<User[]>("/users");
if (result.kind === "ok") {
  // result.data is User[]
}
```

Methods: `api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()`

**Retry behavior:**
- 2 retries with exponential backoff
- Does NOT retry on 401, 403, 404

### authenticatedFetch (`client/lib/api/authenticatedFetch.ts`)

Amplify-aware fetch that injects Cognito session tokens:

```typescript
import { authenticatedFetch } from "@/client/lib/api";

const response = await authenticatedFetch("/api/protected-endpoint", {
  method: "POST",
  body: JSON.stringify(data),
});
```

- Automatically retrieves token from `fetchAuthSession()`
- Sets `Authorization: Bearer <token>` header

## Production Server

The Express server (`server/index.ts`) provides:

### Rate Limiting

| Scope | Limit | Window | Routes |
|-------|-------|--------|--------|
| General | 500 requests | 15 minutes | All `/api/*` |
| Strict | 10 requests | 1 minute | `/api/media/getUploadUrl`, `/api/reports`, `/api/corrections` |

### Security Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation disabled)
- `Strict-Transport-Security` (prod only, 1 year max-age)
- Request ID tracking (UUID per request)

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `EXPO_PUBLIC_USER_POOL_ID` | Cognito User Pool ID | For auth |
| `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | Cognito App Client ID | For auth |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN | Optional |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | Optional |
| `PORT` | Server port (default 3000) | Optional |
| AWS S3/R2 credentials | S3 bucket access | For media API |

## Shared Types (`shared/media.ts`)

```typescript
const MEDIA_PATHS = {
  avatars: "users/avatars",
  videos: "videos",
  thumbnails: "thumbnails",
  uploads: "uploads",
};

type MediaType = keyof typeof MEDIA_PATHS;  // "avatars" | "videos" | ...
type MediaPath = typeof MEDIA_PATHS[MediaType];  // "users/avatars" | ...
```

Utility functions: `getVideoThumbnailKey()`, `isVideoKey()`, `isImageKey()`
