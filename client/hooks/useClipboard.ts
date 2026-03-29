import { useState, useCallback, useRef, useEffect } from "react";
import * as Clipboard from "expo-clipboard";

interface UseClipboardOptions {
  /** Duration in ms to keep `copied` as `true` after a successful copy. Default: 2000 */
  copiedDuration?: number;
}

interface UseClipboardReturn {
  /** Copy text to the clipboard */
  copy: (text: string) => Promise<void>;
  /** Read text from the clipboard */
  paste: () => Promise<string>;
  /** Whether a copy succeeded recently (resets after `copiedDuration` ms) */
  copied: boolean;
  /** Last error message, or null */
  error: string | null;
}

/**
 * Clipboard access with a `copied` feedback flag.
 *
 * @param options - Optional config: `copiedDuration` controls how long `copied` stays `true`
 * @returns `{ copy, paste, copied, error }`
 *
 * @example
 * ```tsx
 * const { copy, copied } = useClipboard();
 *
 * <Button onPress={() => copy(referralCode)}>
 *   {copied ? "Copied!" : "Copy Code"}
 * </Button>
 * ```
 */
export function useClipboard(options?: UseClipboardOptions): UseClipboardReturn {
  const { copiedDuration = 2000 } = options ?? {};
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await Clipboard.setStringAsync(text);
        setError(null);
        setCopied(true);

        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, copiedDuration);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to copy");
      }
    },
    [copiedDuration]
  );

  const paste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      return text;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to paste");
      return "";
    }
  }, []);

  return { copy, paste, copied, error };
}
