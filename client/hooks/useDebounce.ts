import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface DebouncedFunction<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of inactivity.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebounce(query, 300);
 *
 * useEffect(() => {
 *   if (debouncedQuery) fetchResults(debouncedQuery);
 * }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns a stable debounced version of `callback` that delays invocation
 * until `delay` ms have elapsed since the last call.
 *
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds
 * @param options - Optional config: `leading` fires on the first call instead of the last
 * @returns A debounced function with a `.cancel()` method
 *
 * @example
 * ```tsx
 * const debouncedValidate = useDebouncedCallback((value: string) => {
 *   validateField(value);
 * }, 500);
 *
 * // Leading-edge: fire immediately, then suppress
 * const debouncedSave = useDebouncedCallback(save, 1000, { leading: true });
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
  options?: { leading?: boolean }
): DebouncedFunction<T> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadingFiredRef = useRef(false);

  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    leadingFiredRef.current = false;
  }, []);

  useEffect(() => {
    return cancel;
  }, [cancel]);

  const debouncedFn = useMemo(() => {
    const fn = (...args: Parameters<T>) => {
      const leading = options?.leading ?? false;

      if (leading && !leadingFiredRef.current) {
        leadingFiredRef.current = true;
        callbackRef.current(...args);
      }

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (!leading) {
          callbackRef.current(...args);
        }
        leadingFiredRef.current = false;
        timerRef.current = null;
      }, delay);
    };

    fn.cancel = cancel;
    return fn as DebouncedFunction<T>;
  }, [delay, options?.leading, cancel]);

  return debouncedFn;
}
