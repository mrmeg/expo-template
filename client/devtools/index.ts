/**
 * Development tools exports.
 * These are conditionally loaded based on __DEV__ flag.
 */

export { setupReactotron, reactotron } from "./ReactotronClient";

// Only console.log if in dev mode
export function logDev(...args: any[]) {
  if (__DEV__) console.log(...args);
}
