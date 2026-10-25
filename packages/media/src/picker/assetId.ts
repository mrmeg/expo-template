let counter = 0;

/**
 * A unique id for a picked asset.
 *
 * Not `ulid`: its React Native build throws `PRNG_DETECT` when
 * `crypto.getRandomValues` is missing, and Hermes ships neither that nor
 * `randomUUID` without a polyfill. These ids only key a list in memory, so the
 * chain degrades to time + counter + `Math.random` instead of failing a pick.
 */
export function createPickedAssetId(): string {
  const webCrypto = (globalThis as { crypto?: Partial<Crypto> }).crypto;

  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

  let entropy = "";
  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = webCrypto.getRandomValues(new Uint8Array(8));
    entropy = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } else {
    entropy = Math.random().toString(16).slice(2, 12).padEnd(10, "0");
  }

  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${entropy}`;
}
