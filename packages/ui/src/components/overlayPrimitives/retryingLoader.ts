/**
 * Shares one load between callers and, when it fails, keeps that failure for
 * `retryDelayMs` before a later call may load again.
 *
 * The delay matters under `React.use`. React re-renders after a rejection and must
 * read the same promise to throw it to an error boundary; clearing it at once would
 * start a new load on every retry and never surface the error.
 */
export function retryingLoader<T>(load: () => Promise<T>, retryDelayMs: number): () => Promise<T> {
  let current: Promise<T> | null = null;

  return () => {
    if (current) return current;
    const attempt = load();
    current = attempt;
    attempt.catch(() => {
      setTimeout(() => {
        if (current === attempt) current = null;
      }, retryDelayMs);
    });
    return attempt;
  };
}
