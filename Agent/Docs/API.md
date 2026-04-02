# API Reference

## Client-Side API Clients

This project provides two API client implementations in `client/lib/api/`. They serve different purposes and should not be mixed.

### 1. `apiClient` -- Typed Discriminated Union Client

**File:** `client/lib/api/apiClient.ts`

A class-based singleton (`api`) that wraps `fetch` with typed error handling, retry logic, and timeout support. Returns discriminated union responses instead of throwing.

#### Import

```ts
import { api } from "@/client/lib/api/apiClient";
```

#### Methods

| Method | Signature | Default Retry |
|--------|-----------|---------------|
| `get` | `get<T>(path, options?): Promise<ApiResult<T>>` | 2 retries |
| `post` | `post<T>(path, data?, options?): Promise<ApiResult<T>>` | 0 (no retry) |
| `put` | `put<T>(path, data?, options?): Promise<ApiResult<T>>` | 0 (no retry) |
| `patch` | `patch<T>(path, data?, options?): Promise<ApiResult<T>>` | 0 (no retry) |
| `delete` | `delete<T>(path, options?): Promise<ApiResult<T>>` | 0 (no retry) |
| `request` | `request<T>(method, path, data?, options?): Promise<ApiResult<T>>` | 0 (configurable) |

#### Configuration Methods

```ts
api.setAuthToken(token: string | null)   // Set Bearer token for all requests
api.getAuthToken(): string | null        // Get current token
api.setBaseUrl(url: string)              // Change base URL at runtime
```

#### RequestOptions

```ts
interface RequestOptions {
  headers?: Record<string, string>;   // Custom headers
  timeout?: number;                    // Timeout in ms (default: from Config.apiTimeout, which is 10000)
  credentials?: RequestCredentials;    // Cookie handling
  retry?: number;                      // Max retries for temporary failures
  retryDelay?: number;                 // Base delay for exponential backoff (default: 1000ms)
}
```

#### ApiResult<T> -- Discriminated Union

Every method returns `ApiResult<T>`, which is either a success or a problem:

```ts
type ApiResult<T> = ApiOk<T> | ApiProblem;

type ApiOk<T> = { kind: "ok"; data: T };
```

#### ApiProblem -- Error Types

| Kind | Properties | Temporary | Trigger |
|------|------------|-----------|---------|
| `"timeout"` | `temporary: true` | Yes | Request timeout or HTTP 408 |
| `"cannot-connect"` | `temporary: true` | Yes | Connection failure |
| `"network-error"` | `temporary: true` | Yes | `TypeError` from fetch |
| `"server"` | `status: number`, `temporary?: true` | 502/503/504 yes, 500 no | 5xx status codes |
| `"unauthorized"` | -- | No | HTTP 401 |
| `"forbidden"` | -- | No | HTTP 403 |
| `"not-found"` | -- | No | HTTP 404 |
| `"rejected"` | `status: number` | No | Other 4xx status codes |
| `"bad-data"` | -- | No | JSON parse failure |
| `"unknown"` | `temporary: true` | Yes | Unrecognized error |

Only problems with `temporary: true` are retried. Retries use exponential backoff with jitter, capped at 30 seconds.

#### Usage

```ts
const result = await api.get<User[]>("/users");

if (result.kind === "ok") {
  console.log(result.data); // User[]
} else {
  console.log(result.kind); // "timeout" | "unauthorized" | etc.
}
```

#### Human-Readable Error Messages

```ts
import { getApiProblemMessage } from "@/client/lib/api/apiClient";

if (result.kind !== "ok") {
  alert(getApiProblemMessage(result));
  // "Request timed out. Please try again."
  // "You need to log in to continue."
  // "Network error. Please check your connection."
  // etc.
}
```

---

### 2. `authenticatedFetch` -- Amplify-Aware Client

**File:** `client/lib/api/authenticatedFetch.ts`

A function-based client that automatically injects Cognito access tokens from `aws-amplify/auth`. Returns raw `Response` objects (like native fetch). Throws on errors.

#### Import

```ts
import { api } from "@/client/lib/api/authenticatedFetch";
// or
import { authenticatedFetch } from "@/client/lib/api/authenticatedFetch";
```

#### Convenience Methods

| Method | Signature |
|--------|-----------|
| `api.get` | `get(url, options?): Promise<Response>` |
| `api.post` | `post(url, body?, options?): Promise<Response>` |
| `api.put` | `put(url, body?, options?): Promise<Response>` |
| `api.patch` | `patch(url, body?, options?): Promise<Response>` |
| `api.delete` | `delete(url, body?, options?): Promise<Response>` |

Each method automatically calls `fetchAuthSession()` to get the current Cognito access token and sets it as a Bearer Authorization header.

#### Direct Function

```ts
authenticatedFetch(url: string, options?: ApiOptions): Promise<Response>
```

#### ApiOptions

```ts
interface ApiOptions extends RequestInit {
  body?: any;                // Auto-serialized to JSON
  token?: string;            // Manual token override (bypasses auto-fetch)
  signal?: AbortSignal;      // Custom abort signal (disables auto-timeout)
  timeout?: number;          // Timeout in ms (default: 30000). Ignored when signal is provided.
}
```

#### Behavior

- **Auto token injection** -- Calls `fetchAuthSession()` before each request to get a fresh access token
- **Default timeout** -- 30 seconds (creates an AbortController internally). Disabled when a custom `signal` is provided.
- **401 handling** -- Throws `Error("Unauthorized")` on 401 responses
- **JSON serialization** -- Body is auto-serialized via `JSON.stringify()`
- **Content-Type** -- Always sets `Content-Type: application/json`

#### Usage

```ts
const response = await api.post("/api/media/getUploadUrl", {
  extension: "png",
  mediaType: "uploads",
});
const data = await response.json();
```

---

## React Query Configuration

Defined in `app/_layout.tsx` as a module-level `QueryClient`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes
      gcTime: 1000 * 60 * 10,     // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
```

| Setting | Value | Notes |
|---------|-------|-------|
| `staleTime` | 5 minutes | Data considered fresh for 5 min after fetch |
| `gcTime` | 10 minutes | Unused cache entries garbage-collected after 10 min |
| `refetchOnWindowFocus` | `false` | No automatic refetch on tab focus |
| Query retry | Max 2, skip 4xx | Only retries server/network errors |
| Mutation retry | `false` | Mutations never auto-retry |

---

## API Routes

All routes are in `app/api/` using Expo Router convention. Files with `+api.ts` suffix export HTTP method handlers. Every route exports an `OPTIONS` handler for CORS preflight.

### POST `/api/media/getUploadUrl`

Generate a presigned S3/R2 upload URL.

**Request:**

```ts
{
  extension: string;        // File extension, e.g. "png", "jpg"
  mediaType: MediaType;     // "avatars" | "videos" | "thumbnails" | "uploads"
  customFilename?: string;  // Optional filename (without extension). ULID generated if omitted.
}
```

**Response (200):**

```ts
{
  uploadUrl: string;   // Presigned PUT URL (5-minute expiry)
  key: string;         // Storage key, e.g. "uploads/01HX7Y2K3M.png"
  expiresAt: string;   // ISO 8601 expiration timestamp
}
```

**Errors:** 400 (missing/invalid extension or mediaType), 500 (S3 client error).

---

### DELETE `/api/media/delete`

Delete a single file from R2.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Full object key to delete |

**Response (200):**

```ts
{ success: true, key: string }
```

**Errors:** 400 (missing key), 500 (S3 client error).

---

### POST `/api/media/delete`

Batch delete multiple files from R2.

**Request:**

```ts
{
  keys: string[];   // Array of object keys to delete (max 1000)
}
```

**Response (200):**

```ts
{
  success: true,
  deleted: string[],                              // Keys that were deleted
  errors: Array<{ key: string; message: string }>  // Keys that failed
}
```

**Errors:** 400 (missing/invalid keys array, or exceeds 1000 limit), 500 (S3 client error).

---

### GET `/api/media/list`

List media objects with cursor-based pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prefix` | string | `""` | Filter by key prefix (e.g. `"uploads/"`) |
| `cursor` | string | -- | Continuation token for pagination |
| `limit` | number | `100` | Max items per page (capped at 1000) |

**Response (200):**

```ts
{
  items: Array<{
    key: string;           // Object key
    size: number;          // Size in bytes
    lastModified: string;  // ISO 8601 timestamp
  }>,
  totalCount: number,     // Number of items in this page
  nextCursor?: string     // Pass as `cursor` for next page (absent when no more)
}
```

**Errors:** 500 (S3 client error).

---

### POST `/api/media/getSignedUrls`

Generate presigned download URLs for multiple files.

**Request:**

```ts
{
  keys: string[];      // Array of object keys (or filenames if path is provided)
  path?: string;       // Optional prefix prepended to each key
}
```

**Response (200):**

```ts
{
  urls: {
    [key: string]: string  // Map of requested key to presigned GET URL (24-hour expiry)
  }
}
```

**Errors:** 400 (missing/invalid keys array), 500 (S3 client error).

---

## CORS

**File:** `app/api/_shared/cors.ts`

Shared utility used by all API routes.

### Functions

| Function | Purpose |
|----------|---------|
| `getCorsHeaders(request)` | Returns CORS headers if request Origin matches allowlist |
| `getPreflightHeaders(request)` | Returns CORS headers + `Access-Control-Max-Age: 86400` |
| `sanitizeErrorDetails(error)` | Returns `{ details: message }` in dev, `{}` in production |

### Behavior

- **Origin validation** -- Checks `Origin` header against `ALLOWED_ORIGINS` env var (comma-separated). Defaults to `["http://localhost:8081", "http://localhost:3000"]`.
- **No Origin header** -- Returns no CORS headers (same-origin or native app request).
- **Disallowed origin** -- Returns only `Vary: Origin` (no `Access-Control-Allow-Origin`).
- **Allowed origin** -- Echoes back the specific origin (not `*`), sets `Allow-Methods: GET, POST, OPTIONS` and `Allow-Headers: Content-Type, Authorization`.
- **Vary header** -- Always includes `Vary: Origin` to prevent CDN cache poisoning.

---

## Authentication

### Configuration

AWS Amplify v6 with Cognito. Lazy initialization via `ensureAmplifyConfigured()` in `client/features/auth/config.ts`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_USER_POOL_ID` | Cognito User Pool ID |
| `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | Cognito App Client ID |

### Auth Store

**File:** `client/features/auth/stores/authStore.ts`

State machine: `"loading"` | `"authenticated"` | `"unauthenticated"`

Key fields:
- `state` -- Current auth state
- `user` -- `{ userId, username, email? }` or `null`
- `pendingVerificationEmail` -- Email awaiting verification
- `error` -- Last error message
- `isInitializing` -- Guard flag to prevent concurrent initialization
- `lastInitializeTime` -- Timestamp for 2-second throttle

### Auth Hook

**File:** `client/features/auth/hooks/useAuth.ts`

Provides: `signIn`, `signUp`, `confirmSignUp`, `forgotPassword`, `resetPassword`, `signOut`.

### Hub Events

`initAuth()` registers an Amplify Hub listener for:
- `signedIn` / `signInWithRedirect` -- Triggers `initialize()` after 500ms delay (with state check)
- `signedOut` -- Clears user
- `tokenRefresh` -- Logged only
- `tokenRefresh_failure` -- Sets error message
- `confirmSignUp` / `signUp` -- Triggers `autoSignIn()` if next step is `COMPLETE_AUTO_SIGN_IN`

### Token Injection

`authenticatedFetch` calls `fetchAuthSession()` from `aws-amplify/auth` before each request. Extracts `session.tokens?.accessToken` and sets it as `Authorization: Bearer <token>`.

---

## Shared Types

### MediaType

```ts
// from shared/media.ts
type MediaType = "avatars" | "videos" | "thumbnails" | "uploads";

const MEDIA_PATHS = {
  avatars: "users/avatars",
  videos: "videos",
  thumbnails: "thumbnails",
  uploads: "uploads",
} as const;
```

### Pagination (apiClient types)

```ts
interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
```

### HttpMethod

```ts
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
```
