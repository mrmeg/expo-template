import * as Crypto from "expo-crypto";

/**
 * A random id for a picked asset — native build. Hermes has no
 * `crypto.randomUUID()`, so native reads it from `expo-crypto`; web calls
 * `globalThis.crypto` directly (`assetId.ts`).
 */
export function createAssetId(): string {
  return Crypto.randomUUID();
}
