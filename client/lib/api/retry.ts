/**
 * Retry utility for API requests.
 */

/**
 * Calculate exponential backoff delay with jitter.
 *
 * @param attempt - Zero-based attempt number
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Delay in ms, capped at 30 seconds
 */
export function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay * 0.5;
  return Math.min(exponential + jitter, 30000);
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
