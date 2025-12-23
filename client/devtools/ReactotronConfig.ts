/**
 * Reactotron configuration entry point.
 * Import this in _layout.tsx to enable Reactotron in development.
 *
 * Usage in _layout.tsx:
 * ```tsx
 * if (__DEV__) {
 *   import('@/client/devtools/ReactotronConfig');
 * }
 * ```
 */

import { setupReactotron, reactotron } from "./ReactotronClient";

// Only initialize in development
if (__DEV__) {
  setupReactotron();
  console.log("Reactotron configured");
}

export { reactotron };
