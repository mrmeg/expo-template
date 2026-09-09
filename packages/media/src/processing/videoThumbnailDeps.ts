/**
 * Web/default loader for the native thumbnail dependencies: there are none.
 * `extractVideoThumbnail` takes the `<video>` + canvas path on web before it
 * would ever call this, so returning `null` is only a type-level fallback. See
 * `videoThumbnailDeps.native.ts` for why the `import()` calls live there.
 */

import type { NativeThumbnailDependencies } from "./videoThumbnailNative";

export async function loadNativeThumbnailDependencies(): Promise<NativeThumbnailDependencies | null> {
  return null;
}
