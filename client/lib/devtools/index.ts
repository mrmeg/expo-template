/**
 * Development tools exports.
 * These are conditionally loaded based on __DEV__ flag.
 */

// Only console.log if in dev mode
export function logDev(...args: unknown[]) {
  if (__DEV__) console.log(...args);
}
