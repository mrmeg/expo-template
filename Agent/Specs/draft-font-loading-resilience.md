# Spec: Font Loading Resilience

**Status:** Draft
**Priority:** Low
**Scope:** Client

---

## What

Add a 5-second timeout to font loading in `useResources`. If fonts fail to load within the timeout, proceed with system fallback fonts instead of blocking the splash screen indefinitely. Log the error but do not crash.

## Why

The current `useResources` hook calls `Font.loadAsync()` with no timeout. If the font loading hangs (corrupted asset, slow bundler reload, platform-specific font loading bug), the splash screen stays visible forever and the app appears frozen. Users cannot interact with the app or even see an error. Adding a timeout with graceful degradation ensures the app always becomes usable within a reasonable time.

## Current State

**File:** `client/hooks/useResources.ts`

```ts
export const useResources = (): LoadResourcesResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadResourcesAndDataAsync() {
      try {
        await Font.loadAsync({
          ...Feather.font,
          "Lato_400Regular": require("@/assets/fonts/Lato/Lato-Regular.ttf"),
          "Lato_700Bold": require("@/assets/fonts/Lato/Lato-Bold.ttf"),
        });
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.warn(error);
        setError(error);
      } finally {
        setLoaded(true);
      }
    }
    loadResourcesAndDataAsync();
  }, []);

  return { loaded, error };
};
```

- `Font.loadAsync` has no timeout. If it never resolves, `loaded` stays `false` forever.
- The `catch` block already handles errors gracefully (sets error, proceeds via `finally`).
- The `finally` block already sets `loaded: true` on both success and error -- so the only failure mode is a hanging promise.

**File:** `app/_layout.tsx`

```ts
const { loaded: fontsLoaded } = useResources();
// ...
if (!fontsLoaded || !i18nReady) {
  return null; // Splash screen stays visible
}
```

- The root layout renders `null` (keeping splash screen) until `fontsLoaded` is `true`.

## Changes

### 1. Add timeout utility

**File:** `client/hooks/useResources.ts`

Add a `withTimeout` helper function at the top of the file (or inline within the hook):

```ts
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
```

### 2. Wrap `Font.loadAsync` with timeout

**File:** `client/hooks/useResources.ts`

Replace the bare `Font.loadAsync(...)` call with:

```ts
const FONT_LOAD_TIMEOUT_MS = 5000;

await withTimeout(
  Font.loadAsync({
    ...Feather.font,
    "Lato_400Regular": require("@/assets/fonts/Lato/Lato-Regular.ttf"),
    "Lato_700Bold": require("@/assets/fonts/Lato/Lato-Bold.ttf"),
  }),
  FONT_LOAD_TIMEOUT_MS,
  "Font loading"
);
```

The existing `catch` block already handles errors and the existing `finally` block already sets `loaded: true`, so no other changes are needed. When the timeout fires:
1. The `catch` block catches the timeout error.
2. `console.warn` logs "Font loading timed out after 5000ms".
3. `setError` stores the error (available to callers).
4. `finally` sets `loaded: true`.
5. The app proceeds with system fallback fonts.

### 3. Export the timeout constant

**File:** `client/hooks/useResources.ts`

Export `FONT_LOAD_TIMEOUT_MS` so tests can reference it:

```ts
export const FONT_LOAD_TIMEOUT_MS = 5000;
```

## Acceptance Criteria

1. If `Font.loadAsync` resolves within 5 seconds, behavior is identical to today (fonts load normally).
2. If `Font.loadAsync` hangs beyond 5 seconds, the hook sets `loaded: true` and `error` to a timeout error, and the app proceeds with system fonts.
3. If `Font.loadAsync` rejects (non-timeout error), existing behavior is preserved (error logged, app proceeds).
4. The splash screen hides within 5 seconds even if fonts never load.
5. `console.warn` is called with the timeout error (not `console.error` -- this is a degradation, not a crash).
6. The timeout constant is exported for testability.
7. No changes to the `useResources` return type or public API.
8. All existing tests pass.

## Constraints

- Do not change the `LoadResourcesResult` interface.
- Do not add new dependencies. The timeout is implemented with `setTimeout` and `Promise.race` (or equivalent).
- Do not change the fallback behavior on error -- the existing `catch`/`finally` pattern is correct and should be preserved.
- The timeout value (5 seconds) should be a named constant, not a magic number.
- Fonts are bundled locally (not fetched from network), so 5 seconds is generous. The timeout is a safety net, not a normal code path.

## Out of Scope

- Retry logic for font loading (unnecessary for bundled fonts)
- Loading indicator between splash screen and app ready (separate concern)
- Timeout for i18n initialization (separate spec if needed)
- System font configuration or fallback font selection (already handled by React Native defaults)
- Preloading fonts at build time

## Files Likely Affected

**Client:**
- `client/hooks/useResources.ts` (add timeout wrapper around `Font.loadAsync`)

## Edge Cases

- **Font loads in exactly 5 seconds:** The timeout fires at 5000ms. If `Font.loadAsync` resolves at the same tick, the `clearTimeout` in the `then` handler prevents the timeout rejection. Race condition is handled by the Promise wrapper -- first to settle wins.
- **Multiple rapid re-mounts:** The `useEffect` cleanup does not cancel the font loading (it can't -- `Font.loadAsync` has no cancel API). However, the `finally` block will still fire, and React's state update will be a no-op if the component unmounted. This is unchanged from current behavior.
- **Web platform:** `Font.loadAsync` on web loads fonts via CSS `@font-face`. This is typically fast but can hang if the bundler serves stale assets. The timeout covers this case.
- **Feather icon font fails:** The `Feather.font` is included in the same `Font.loadAsync` call. If it hangs, the timeout catches it. Feather icons will render as blank squares, but the app remains usable.

## Risks

- **False positives in CI:** Jest tests using fake timers may need adjustment if they test `useResources` directly. The timeout introduces a real timer that fake timers need to advance. Low risk since the existing tests likely mock `Font.loadAsync` to resolve immediately.
