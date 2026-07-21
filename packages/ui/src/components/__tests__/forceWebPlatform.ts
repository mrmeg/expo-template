/**
 * Test-only side effect: forces `Platform.OS` to `"web"` for the importing
 * test file, before any other local import resolves.
 *
 * Babel's ESM->CJS transform hoists `import` statements above plain
 * statements, but hoisted imports still execute in their textual source
 * order relative to each other. Importing this module first (before
 * `StyledText`/`constants/fonts`) means the `Platform.OS` mutation below
 * runs before `constants/fonts.ts` resolves its module-load-time
 * `fontFamilies` snapshot (see the SSR-safety comment there) — a plain
 * `Platform.OS = "web"` statement inside the test body runs too late for
 * that module, even though it's early enough for StyledText's own render-time
 * `Platform.OS` check.
 *
 * Not applicable outside this test suite; not exported by the package.
 */
import { Platform } from "react-native";

Platform.OS = "web";

export {};
