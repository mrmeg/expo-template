/**
 * A random id for a picked asset — web (and server) build.
 *
 * `globalThis.crypto.randomUUID()` is exactly what `expo-crypto`'s web build
 * calls, so importing that package here would add a module to the shared web
 * chunk for nothing. Native keeps `expo-crypto` (`assetId.native.ts`).
 */
export function createAssetId(): string {
  return globalThis.crypto.randomUUID();
}
