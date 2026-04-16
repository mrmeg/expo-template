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
architecture. The route files live in `app/api/billing/` and depend
on the process-wide registry in `server/api/billing/registry.ts`;
when the registry is unconfigured every route returns `503`
`billing-disabled`.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/billing/summary` | GET | Cognito bearer | Return normalized `BillingSummary` for the signed-in user |
| `/api/billing/checkout-session` | POST | Cognito bearer | Create a Stripe Checkout Session in `subscription` mode; returns `{ url, expiresAt }` |
| `/api/billing/portal-session` | POST | Cognito bearer | Create a Stripe Billing Portal session; returns `{ url }` |
| `/api/billing/webhook` | POST | Stripe signature (no Cognito) | Receive Stripe events; server-authoritative state writes |

**Authentication**: protected routes call `requireAuthenticatedUser`
from `server/api/shared/auth.ts`. That helper extracts the bearer token,
passes it to the process-wide `TokenVerifier`, and returns a
`{ userId, email }` shape — or a structured 401 response when the
header is missing, the scheme is not Bearer, the token is empty, no
verifier is registered (fail closed), or verification throws.

**Checkout body**:

```ts
type CheckoutBody = {
  planId: string;              // from the plan catalog
  interval: "month" | "year";
  returnPath?: string;         // defaults to "/billing/return"
};

type CheckoutResponse = {
  url: string;                 // Stripe Checkout Session URL
  expiresAt: string | null;
};
```

The server maps `{ planId, interval }` onto a server-owned Stripe
price id. Clients MUST NOT send raw price ids — unknown plans return
`400 unknown-plan` with the catalog's ids; plans missing a price for
the requested interval return `422 configuration-missing`.

**Portal body**:

```ts
type PortalBody = { returnPath?: string };
type PortalResponse = { url: string };
```

Users with no Stripe customer return `409 no-customer`.

**Typed error codes** (client `BillingProblem` union in
`client/features/billing/lib/problem.ts`):

| HTTP | `code` | Meaning |
|------|--------|---------|
| 401 | `unauthorized` | Missing/invalid bearer token |
| 400 | `bad-request` | Malformed body |
| 400 | `unknown-plan` | `planId` not in catalog (body includes `availablePlans`) |
| 400 | `missing-signature` | Webhook without `Stripe-Signature` |
| 400 | `invalid-signature` | Webhook signature rejected |
| 409 | `billing-conflict` | Multiple Stripe customers match this user (body includes `candidateCustomerIds`) |
| 409 | `no-customer` | Portal opened for a user with no Stripe customer |
| 422 | `configuration-missing` | Plan has no price configured for the requested interval |
| 503 | `billing-disabled` | Billing registry not configured on this server |
| 500 | `server-error` | Unhandled server-side failure |
| 500 | `webhook-handler-failed` | Webhook handler threw — Stripe will retry (event NOT marked processed) |

**Webhook raw-body contract**: `webhook+api.ts` calls
`request.text()` BEFORE any JSON parsing, so the bytes handed to the
signature verifier match exactly what Stripe signed. Do not call
`request.json()` on this route. If the Expo Server adapter ever
inserts body-parsing middleware upstream, mount a dedicated Express
raw-body route for `/api/billing/webhook` ahead of
`createRequestHandler()`.

**Idempotency**: the webhook route short-circuits duplicate
deliveries via an in-memory `IdempotencyStore`
(`server/api/billing/idempotency.ts`). Multi-instance
deployments MUST swap this for a shared store (Redis, Postgres
unique index) using `setWebhookIdempotencyStore(...)`. The handler
is only marked processed on success — failures leave the event
unmarked so Stripe's retries re-run it.

**Rate limits**: `/api/billing/checkout-session` and
`/api/billing/portal-session` are registered in `STRICT_LIMIT_PATHS`
(10/min). The webhook is NOT strict-limited — Stripe retries burst
faster than 10/min and its signature requirement already gates abuse.

**Normalized summary shape** (canonical definition in
`shared/billing.ts`):

```ts
interface BillingSummary {
  customerId: string | null;
  planId: string;
  planLabel: string;
  status: "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  interval: "month" | "year" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
  sourceUpdatedAt: string;
}
```

The summary is keyed to the Cognito `sub`, not email. Raw Stripe IDs
stay server-side; clients never read them. The server-side resolver
(`server/api/billing/account.ts`) owns deterministic Stripe
customer linking (metadata lookup → single-match email backfill →
`CustomerConflictError` → create).

**Rate limits:** `/api/billing/checkout` and `/api/billing/portal` should
be registered in `STRICT_LIMIT_PATHS` (see Rate Limiting table below)
when the routes land, alongside `/api/media/getUploadUrl`.

**Return URL contract:** hosted sessions redirect to a single return
path (`/billing/return`) with `status=success|cancel|portal`. Web uses
`https://…/billing/return`; native uses `myapp://billing/return` via
`expo-web-browser`'s `openAuthSessionAsync`. Client refetches the
summary on return — the redirect is a UX hint, not proof of payment.

### CORS

All API routes handle OPTIONS preflight. CORS is configured in `server/api/shared/cors.ts`:

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
| `EXPO_PUBLIC_BILLING_ENABLED` | Billing feature flag (`"true"` to enable) | Optional (default `false`) |
| `EXPO_PUBLIC_APP_URL` | Absolute web origin for hosted-billing return URLs | Required when billing is enabled and the request origin is not the public origin |
| `STRIPE_SECRET_KEY` | Stripe server SDK key | For billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe signature verification secret | For billing |
| `STRIPE_PRICE_ID_<PLAN>_MONTH` | Monthly price id for `<plan>` in the catalog | For that plan's monthly option |
| `STRIPE_PRICE_ID_<PLAN>_YEAR` | Yearly price id for `<plan>` in the catalog | For that plan's yearly option |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | Optional |
| `PORT` | Server port (default 3000) | Optional |
| AWS S3/R2 credentials | S3 bucket access | For media API |

Billing is opt-in: with neither Stripe key set, every `/api/billing/*`
route returns `503 billing-disabled` and no Stripe traffic is ever
generated. Full setup walkthrough (products, prices, `stripe listen`
webhook forwarding) lives in [`BILLING.md`](./BILLING.md#local-setup-fresh-stripe-account).

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
