# Spec: Utility Hooks Bundle

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## Summary

Add three general-purpose hooks to `client/hooks/` that eliminate recurring boilerplate across the app: `useDebounce` for rate-limiting reactive values and callbacks, `useClipboard` for copy/paste with user feedback, and `useToggle` for boolean state management. These follow the same conventions as the existing hooks (`useScalePress`, `useDimensions`, `useReduceMotion`, `useStaggeredEntrance`).

---

## Motivation

- **useDebounce** — The current form demo (`app/(main)/(demos)/form-demo.tsx`) validates on blur, but search inputs and real-time validation need debounced values. Today there is no debounce utility in the project; consumers would need to hand-roll `setTimeout`/`clearTimeout` each time.
- **useClipboard** — Copy-to-clipboard is a common action (sharing links, copying tokens, referral codes). There is no clipboard abstraction and `expo-clipboard` is not yet installed.
- **useToggle** — Modals, collapsible sections, and expanded states all need `[value, toggle]`. Every instance currently uses `useState(false)` plus a manual `setX(prev => !prev)` callback.

---

## Detailed Design

### A) useDebounce (`client/hooks/useDebounce.ts`)

Two exports from the same file:

**`useDebounce<T>(value: T, delay: number): T`**
- Returns a debounced copy of `value` that only updates after `delay` ms of inactivity.
- Cleans up the internal `setTimeout` on unmount and whenever `value` or `delay` changes.
- Implementation: `useState` + `useEffect` with `setTimeout`/`clearTimeout`.

**`useDebouncedCallback(callback: (...args: any[]) => void, delay: number, options?: { leading?: boolean }): (...args: any[]) => void`**
- Returns a stable debounced version of `callback` (memoized with `useRef`/`useCallback`).
- `options.leading` (default `false`): when `true`, fires on the leading edge (first call) and then suppresses for `delay` ms.
- Cancels pending timeout on unmount via `useEffect` cleanup.
- The returned function should also expose a `.cancel()` method to allow manual cancellation.

**Type signature:**
```ts
export function useDebounce<T>(value: T, delay: number): T;

interface DebouncedFunction<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  options?: { leading?: boolean }
): DebouncedFunction<T>;
```

**Usage examples:**
```tsx
// Debounced search value
const [query, setQuery] = useState("");
const debouncedQuery = useDebounce(query, 300);

useEffect(() => {
  if (debouncedQuery) fetchResults(debouncedQuery);
}, [debouncedQuery]);

// Debounced callback for validation
const debouncedValidate = useDebouncedCallback((value: string) => {
  validateField(value);
}, 500);

// Leading-edge: fire immediately, then suppress
const debouncedSave = useDebouncedCallback(save, 1000, { leading: true });
```

### B) useClipboard (`client/hooks/useClipboard.ts`)

**Dependency:** `expo-clipboard` must be added. It is NOT currently in `package.json`. Install with `bun add expo-clipboard`.

**`useClipboard(): { copy, paste, copied, error }`**

- **`copy(text: string): Promise<void>`**
  - Copies `text` to the system clipboard.
  - Sets `copied` to `true` for 2 seconds (configurable via an options parameter on the hook: `useClipboard({ copiedDuration?: number })`), then resets to `false`.
  - Uses `expo-clipboard` `setStringAsync` on native.
  - Uses `navigator.clipboard.writeText` on web as a fallback if expo-clipboard does not support web (check at implementation time; prefer expo-clipboard if it works on all platforms).
  - Sets `error` string if the operation fails, clears on next successful copy.

- **`paste(): Promise<string>`**
  - Reads text from the clipboard.
  - Uses `expo-clipboard` `getStringAsync` on native.
  - Uses `navigator.clipboard.readText` on web.
  - Note: web browsers may prompt for permission. Wrap in try/catch and set `error` if denied.
  - Returns the clipboard contents as a string (empty string on failure).

- **`copied: boolean`** — UI feedback flag, auto-resets after `copiedDuration` ms.
- **`error: string | null`** — Last error message, or `null`.

**Type signature:**
```ts
interface UseClipboardOptions {
  copiedDuration?: number; // default: 2000
}

interface UseClipboardReturn {
  copy: (text: string) => Promise<void>;
  paste: () => Promise<string>;
  copied: boolean;
  error: string | null;
}

export function useClipboard(options?: UseClipboardOptions): UseClipboardReturn;
```

**Usage example:**
```tsx
const { copy, copied } = useClipboard();

<Button onPress={() => copy(referralCode)}>
  <Text>{copied ? "Copied!" : "Copy Code"}</Text>
</Button>
```

### C) useToggle (`client/hooks/useToggle.ts`)

**`useToggle(initial?: boolean): [boolean, () => void, (value: boolean) => void]`**

- First element: current boolean value (default `false`).
- Second element: `toggle()` — flips the value. Memoized with `useCallback` so it's referentially stable.
- Third element: `setValue(v: boolean)` — sets explicitly. Also memoized.

**Type signature:**
```ts
export function useToggle(
  initial?: boolean
): [value: boolean, toggle: () => void, setValue: (value: boolean) => void];
```

**Usage examples:**
```tsx
// Modal visibility
const [isOpen, toggleOpen, setOpen] = useToggle(false);

<Button onPress={toggleOpen}>Toggle</Button>
<Modal visible={isOpen} onClose={() => setOpen(false)} />

// Expanded state
const [expanded, toggleExpanded] = useToggle();
```

---

## File Structure

```
client/hooks/
  useDebounce.ts      (NEW)
  useClipboard.ts     (NEW)
  useToggle.ts        (NEW)
  useDimensions.ts    (existing)
  useReduceMotion.tsx  (existing)
  useResources.ts     (existing)
  useScalePress.ts    (existing)
  useStaggeredEntrance.ts (existing)
  useTheme.ts         (existing)
```

There is no barrel `index.ts` in `client/hooks/`. Do NOT create one — follow the existing pattern where each hook is imported directly from its file path (e.g., `import { useDebounce } from "@/client/hooks/useDebounce"`).

---

## Dependencies

| Dependency | Action | Reason |
|------------|--------|--------|
| `expo-clipboard` | `bun add expo-clipboard` | Required by `useClipboard` |

No other new dependencies. `useDebounce` and `useToggle` use only React built-ins.

---

## Testing

Each hook gets a test file alongside it:

**`client/hooks/useDebounce.test.ts`**
- Returns initial value immediately.
- Updates returned value after the delay.
- Does not update if value changes within the delay window (resets timer).
- Cleans up timeout on unmount (no state update after unmount).
- `useDebouncedCallback`: fires after delay, not before.
- `useDebouncedCallback` with `leading: true`: fires immediately on first call, suppresses subsequent calls within delay.
- `.cancel()` prevents pending execution.

**`client/hooks/useClipboard.test.ts`**
- `copy()` sets `copied` to `true`, then resets after duration.
- `copy()` with custom `copiedDuration` respects the override.
- `paste()` returns clipboard contents.
- `error` is set when clipboard operation fails.
- `error` clears on next successful `copy()`.

**`client/hooks/useToggle.test.ts`**
- Default initial value is `false`.
- Custom initial value is respected.
- `toggle()` flips the value.
- `toggle()` called twice returns to original.
- `setValue(true)` sets to `true` regardless of current state.
- `toggle` and `setValue` are referentially stable across renders.

---

## Acceptance Criteria

- [ ] All three hooks exist in `client/hooks/` following the project's code style (double quotes, semicolons, 2-space indent).
- [ ] Each hook has JSDoc comments matching the style of existing hooks (see `useScalePress.ts`, `useDimensions.ts`).
- [ ] `expo-clipboard` is installed and listed in `package.json` dependencies.
- [ ] All tests pass.
- [ ] `npx expo lint` passes with no new warnings.
- [ ] TypeScript compiles with no errors.
- [ ] No barrel index file is created for hooks (matches existing convention).

---

## Out of Scope

- Adding these hooks to the showcase/demo screens (separate task).
- Refactoring existing code to use these hooks (separate task).
- Clipboard permission request UI (the hook handles errors, but a permission prompt component is a separate concern).

---

## Risks & Open Questions

- **expo-clipboard web support:** Verify at implementation time that `expo-clipboard` works on web via Expo. If it does not, implement web path using `navigator.clipboard` API directly with a Platform.OS check (same pattern used in `useDimensions.ts` and stores).
- **React 19 compatibility:** The project uses React 19. All three hooks use standard `useState`, `useEffect`, `useCallback`, `useRef` — no concerns expected, but verify tests pass under the project's Jest config.
