/**
 * Reactotron stub for web platform.
 * Reactotron doesn't support web, so we provide no-op implementations.
 */

/**
 * No-op setup for web.
 */
export function setupReactotron() {
  // Reactotron is not supported on web
  return null;
}

/**
 * Stub reactotron instance for web.
 * All methods are no-ops to prevent errors.
 */
export const reactotron = {
  log: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
  display: (_config: unknown) => {},
  clear: () => {},
  benchmark: (_name: string) => ({
    step: (_stepName: string) => {},
    stop: (_stopName?: string) => {},
  }),
  image: (_config: unknown) => {},
  debug: (..._args: unknown[]) => {},
};

export default reactotron;
