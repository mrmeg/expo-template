# Spec: API Client Improvements

**Status:** Ready
**Priority:** High
**Scope:** Client

## What

Add retry with exponential backoff to `apiClient`, configure React Query defaults (staleTime, gcTime, smart retry), and add timeout to `authenticatedFetch`.

## Why

Temporary failures (503, network blips, timeouts) fail immediately with no retry. React Query uses default `staleTime: 0` which refetches on every screen focus/navigation. `authenticatedFetch` has no timeout at all -- a hung server means the request hangs forever.

## Current State

### `apiClient.ts` (`client/lib/api/apiClient.ts`)

- Singleton `Api` class exported as `api`.
- Reads `Config.apiUrl` (base URL) and `Config.apiTimeout` (default 10000ms) from config at construction.
- Has `setAuthToken()` / `getAuthToken()` for manual token management.
- Core `request<T>()` method builds URL from `baseUrl + path`, creates an `AbortController` with configurable timeout, and calls `fetch`.
- Error handling maps responses through `getApiProblem()` which converts HTTP status codes to discriminated union types (`ApiProblem`).
- The `ApiProblem` type already marks certain errors as `temporary: true` (timeout, cannot-connect, network-error, unknown) -- but nothing uses this flag for retry logic.
- Convenience methods: `get`, `post`, `put`, `patch`, `delete` -- all delegate to `request()`.
- **No retry logic.** A 503 or network error returns immediately as `{ kind: "server", status: 503 }` or `{ kind: "network-error", temporary: true }`.

### `authenticatedFetch.ts` (`client/lib/api/authenticatedFetch.ts`)

- Standalone function `authenticatedFetch(url, options)` that wraps `fetch` with auth token injection.
- `getAuthData()` helper calls `fetchAuthSession()` from `aws-amplify/auth` to get the access token.
- Convenience methods exported as `api.get()`, `api.post()`, etc. Each calls `getAuthData()` then `authenticatedFetch()`.
- Accepts an optional `signal` via `ApiOptions extends RequestInit` but does **not** create its own `AbortController` or timeout.
- **No timeout.** If the server hangs, the request hangs indefinitely unless the caller passes their own `AbortSignal`.
- **No retry logic.**
- Throws on 401 with `new Error("Unauthorized")`.
- Logs errors to console (except AbortError which is silently re-thrown).

### React Query setup (`app/_layout.tsx`)

- `QueryClient` is instantiated with zero configuration: `const queryClient = new QueryClient()`.
- This means all defaults apply:
  - `staleTime: 0` -- data is immediately stale, refetched on every window focus and component mount.
  - `gcTime: 300000` (5 minutes) -- cached data garbage collected after 5 minutes of no observers.
  - `retry: 3` with exponential backoff -- React Query does retry by default, but only for query functions that throw. The `apiClient` returns error objects (discriminated unions) instead of throwing, so React Query's retry never triggers for `apiClient` consumers.
  - `refetchOnWindowFocus: true` -- refetches all stale queries when the app regains focus.
  - `refetchOnMount: true` -- refetches stale queries when components mount.

### `apiProblem.ts` (`client/lib/api/apiProblem.ts`)

- Defines the `ApiProblem` discriminated union with a `temporary` flag on transient error kinds.
- `getApiProblem()` maps HTTP status codes: 500/502/503/504 become `{ kind: "server", status }` (no `temporary` flag on server errors).
- `getApiProblemMessage()` provides human-readable messages for each error kind.

### `types.ts` (`client/lib/api/types.ts`)

- `RequestOptions` interface: `headers`, `timeout`, `credentials`.
- `ApiResult<T>` = `ApiOk<T> | ApiProblem`.
- No retry-related options.

## Changes

### 1. Add retry with exponential backoff to `apiClient.ts`

Add a `retry` option to `RequestOptions`:

```ts
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  credentials?: RequestCredentials;
  /** Number of retries for temporary failures (default: 0 for mutations, 2 for GET) */
  retry?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  retryDelay?: number;
}
```

In the `request()` method, after receiving a result with `temporary: true` or a server error with status 502/503/504, retry up to `retry` times with exponential backoff (`retryDelay * 2^attempt` with jitter).

Update `getApiProblem()` to add `temporary: true` to 502/503/504 server errors so the retry logic can key off a single flag:

```ts
case 500:
  return { kind: "server", status };
case 502:
case 503:
case 504:
  return { kind: "server", status, temporary: true };
```

Update the `ApiProblem` type to support `temporary` on server errors:

```ts
| { kind: "server"; status: number; temporary?: true }
```

The convenience methods should set sensible defaults: `get()` defaults to `retry: 2`, mutation methods (`post`, `put`, `patch`, `delete`) default to `retry: 0` (mutations should not auto-retry to avoid duplicate side effects).

### 2. Add timeout to `authenticatedFetch.ts`

Add a `timeout` option to `ApiOptions` and create an internal `AbortController` when no external `signal` is provided:

```ts
interface ApiOptions extends RequestInit {
  body?: any;
  token?: string;
  signal?: AbortSignal;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}
```

In `authenticatedFetch()`:

```ts
const timeoutMs = options.timeout ?? 30000;
let timeoutId: ReturnType<typeof setTimeout> | undefined;

if (!options.signal) {
  const controller = new AbortController();
  timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  requestOptions.signal = controller.signal;
}

try {
  const response = await fetch(url, requestOptions);
  if (timeoutId) clearTimeout(timeoutId);
  // ...
} catch (error) {
  if (timeoutId) clearTimeout(timeoutId);
  // ...
}
```

The default of 30 seconds is intentionally higher than `apiClient`'s 10 seconds because `authenticatedFetch` is used for media operations (uploads, signed URL generation) that can be slower.

### 3. Configure React Query defaults

Update the `QueryClient` instantiation in `app/_layout.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry 4xx errors (client errors)
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
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

Key decisions:
- `staleTime: 5 minutes` prevents refetching on every navigation. This is the single biggest performance win -- screens that show the same data (e.g., navigating back to a list) will use cached data.
- `gcTime: 10 minutes` keeps unused data around longer than the default 5 minutes but does not bloat memory.
- `retry` function skips retries for 4xx (client errors like 401, 404) but retries server errors up to 2 times.
- `refetchOnWindowFocus: false` prevents surprise refetches when switching between apps on mobile. Individual queries can opt back in with `refetchOnWindowFocus: true` where real-time freshness matters.
- Mutations never retry (to prevent duplicate submissions).

### 4. Add backoff utility

Create a small helper in `client/lib/api/retry.ts`:

```ts
export function calculateBackoff(attempt: number, baseDelay: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay * 0.5;
  return Math.min(exponential + jitter, 30000); // cap at 30s
}
```

This keeps the retry logic testable and separate from the request flow.

## Acceptance Criteria

- [ ] `api.get()` retries up to 2 times on temporary failures (503, network error, timeout) with exponential backoff.
- [ ] `api.post()`, `api.put()`, `api.patch()`, `api.delete()` do not retry by default.
- [ ] Callers can override retry count via `options.retry` (including `retry: 0` to disable).
- [ ] `authenticatedFetch` times out after 30 seconds by default when no `signal` is provided.
- [ ] `authenticatedFetch` respects a caller-provided `signal` and does not create a competing timeout.
- [ ] React Query `staleTime` is 5 minutes (queries don't refetch on every navigation).
- [ ] React Query does not retry 4xx errors.
- [ ] React Query mutations never auto-retry.
- [ ] `refetchOnWindowFocus` is disabled globally.
- [ ] `calculateBackoff()` has jitter and caps at 30 seconds.
- [ ] Existing `ApiResult<T>` return type and `ApiProblem` discriminated union are preserved (no breaking type changes).
- [ ] All existing tests pass.

## Constraints

- Do not merge the two API clients. They serve different purposes: `apiClient` is a typed wrapper returning discriminated unions; `authenticatedFetch` is an Amplify-aware raw fetch wrapper. Both are used in different parts of the codebase.
- Do not add new dependencies (no `axios`, `ky`, `retry` packages).
- Keep retry logic synchronous to the request flow (no separate queue or worker).
- Preserve the existing `ApiProblem` union structure. The `temporary` flag addition to server errors must be backward-compatible (optional property).
- The `timeout` option in `authenticatedFetch` must not conflict with caller-provided `AbortSignal` instances.

## Out of Scope

- Request deduplication (React Query handles this for queries).
- Offline detection and request queueing.
- Circuit breaker pattern.
- Global error toast integration (already handled by consumers via `globalUIStore`).
- Retry logic for `authenticatedFetch` (keep it simple -- timeout only).
- Changing which API client is used where in the codebase.
- React Query devtools setup.

## Files Likely Affected

- `client/lib/api/apiClient.ts`
- `client/lib/api/apiProblem.ts`
- `client/lib/api/types.ts`
- `client/lib/api/retry.ts` (new)
- `client/lib/api/authenticatedFetch.ts`
- `app/_layout.tsx`

## Edge Cases

- **Retry after timeout:** When a request times out and is retried, the previous `AbortController` must be cleaned up. Each retry attempt needs its own controller and timeout.
- **Retry with auth token expiry:** If a request fails with 401 during a retry sequence, retrying is pointless. The retry loop must check for non-temporary errors and bail immediately.
- **Backoff jitter overlap:** Two concurrent requests retrying at the same time should not use identical backoff delays. The random jitter component prevents thundering herd behavior.
- **React Query retry + apiClient retry stacking:** If a query function uses `api.get()` (which retries internally) and React Query also retries, the total attempt count multiplies (e.g., 2 internal retries x 2 RQ retries = up to 9 total attempts). Document this and consider setting React Query retry to 0 for queries that use `apiClient` directly, or set `apiClient` retry to 0 when used inside React Query hooks.
- **authenticatedFetch timeout vs. upload time:** Media uploads via `authenticatedFetch` may take longer than 30 seconds for large files. Callers performing uploads should pass `timeout: 120000` or similar. Document the default and how to override.
- **Signal already aborted:** If a caller passes an `AbortSignal` that is already aborted, `authenticatedFetch` should throw immediately rather than starting the request.
- **Network restoration during backoff:** If a network error triggers retry and the network comes back during the backoff wait, the retry will succeed. This is the desired behavior -- no special handling needed.
