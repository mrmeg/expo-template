# API Reference

> Endpoints, schemas, auth patterns, and client-side API layers.

---

## Server API Routes

All routes live in `app/api/media/` and use Expo Router's `+api.ts` convention. They run as serverless functions in production.

Every route implements:
- CORS headers (`Access-Control-Allow-Origin: *`)
- OPTIONS preflight handling
- JSON request/response bodies
- Error responses: `{ error: string }`

### GET /api/media/list

List media objects from R2/S3.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `prefix` | string | `""` | Filter by key prefix (e.g., `users/avatars`) |
| `cursor` | string | — | Pagination cursor from previous response |
| `limit` | number | `100` | Max items per page |

**Response (200):**
```json
{
  "items": [
    {
      "key": "uploads/abc123.jpg",
      "lastModified": "2026-03-15T10:30:00Z",
      "size": 245760,
      "etag": "\"abc123def456\""
    }
  ],
  "totalCount": 42,
  "nextCursor": "token_for_next_page"
}
```

### POST /api/media/getUploadUrl

Get a presigned URL for uploading a file to R2/S3.

**Request Body:**
```json
{
  "extension": "jpg",
  "mediaType": "avatars",
  "customFilename": "thumb_abc123.jpg"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `extension` | string | Yes | File extension (jpg, png, mp4, etc.) |
| `mediaType` | string | Yes | Maps to MEDIA_PATHS key (avatars, videos, thumbnails, uploads) |
| `customFilename` | string | No | Override auto-generated ULID filename |

**Response (200):**
```json
{
  "uploadUrl": "https://r2.example.com/bucket/uploads/abc.jpg?X-Amz-...",
  "key": "uploads/01HQXYZ.jpg",
  "expiresAt": "2026-03-15T10:35:00Z"
}
```

Upload URL expires in **5 minutes**.

### POST /api/media/getSignedUrls

Get presigned download URLs for displaying media files.

**Request Body:**
```json
{
  "keys": ["uploads/abc.jpg", "uploads/def.png"],
  "path": "uploads"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | string[] | Yes | Array of S3 object keys |
| `path` | string | No | Optional path prefix |

**Response (200):**
```json
{
  "urls": {
    "uploads/abc.jpg": "https://r2.example.com/bucket/uploads/abc.jpg?X-Amz-...",
    "uploads/def.png": "https://r2.example.com/bucket/uploads/def.png?X-Amz-..."
  }
}
```

Download URLs expire in **24 hours**.

### DELETE /api/media/delete

Delete a single file.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| `key` | string | Yes |

**Response (200):**
```json
{ "success": true, "key": "uploads/abc.jpg" }
```

### POST /api/media/delete

Batch delete files.

**Request Body:**
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

---

## Shared Constants

`shared/media.ts` provides constants used by both client and server:

```typescript
MEDIA_PATHS = {
  avatars: "users/avatars",
  videos: "videos",
  thumbnails: "thumbnails",
  uploads: "uploads",
}
```

Helper functions: `getVideoThumbnailKey()`, `isVideoKey()`, `isImageKey()`

---

## Client-Side API Layers

### 1. apiClient (`client/lib/api/apiClient.ts`)

Typed fetch wrapper returning discriminated unions. Singleton instance exported as `api`.

```typescript
import { api } from "@/client/lib/api";

const result = await api.get<User[]>("/api/users");
if (result.kind === "ok") {
  console.log(result.data); // User[]
} else {
  console.log(result.kind); // "timeout" | "unauthorized" | "server" | ...
}
```

**Methods:** `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.patch<T>()`, `api.delete<T>()`

**Problem Types (`ApiProblem`):**
| Kind | Temporary | Description |
|------|-----------|-------------|
| `timeout` | Yes | Request timed out |
| `cannot-connect` | Yes | Network unreachable |
| `server` | No | 5xx response (includes `status`) |
| `unauthorized` | No | 401 |
| `forbidden` | No | 403 |
| `not-found` | No | 404 |
| `rejected` | No | Other 4xx (includes `status`) |
| `unknown` | Yes | Unclassifiable error |
| `bad-data` | No | JSON parse failure |
| `network-error` | Yes | Fetch threw |

**Features:**
- Timeout via AbortController
- Auth token injection via `setAuthToken()`
- 204 No Content handling
- Base URL management

### 2. authenticatedFetch (`client/lib/api/authenticatedFetch.ts`)

Amplify-aware fetch that auto-injects Cognito access tokens.

```typescript
import { amplifyApi } from "@/client/lib/api";

const data = await amplifyApi.get<Profile>("/api/profile");
const result = await amplifyApi.post<void>("/api/settings", { theme: "dark" });
```

**Methods:** `amplifyApi.get<T>()`, `amplifyApi.post<T>()`, `amplifyApi.put<T>()`, `amplifyApi.patch<T>()`, `amplifyApi.delete<T>()`

**Behavior:**
- Fetches token from `fetchAuthSession()` on every request
- Sets `Authorization: Bearer <accessToken>` header
- Throws on 401 Unauthorized
- Silently handles abort errors

---

## Auth Configuration

**Environment Variables:**
| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_USER_POOL_ID` | Cognito User Pool ID |
| `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | Cognito App Client ID |

**R2/S3 Environment Variables (server-side):**
| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | S3-compatible secret key |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_PUBLIC_URL` | Public bucket URL (optional) |

---

## React Query Integration

Media hooks use React Query for server state:

| Hook | Query Key | Behavior |
|------|-----------|----------|
| `useMediaList` | `["media-list", prefix]` | Paginated list with cursor |
| `useSignedUrls` | `["signed-urls", keys]` | Cached download URLs |
| `useMediaUpload` | Mutation | Invalidates `media-list` on success |
| `useMediaDelete` | Mutation | Invalidates `media-list` on success |
