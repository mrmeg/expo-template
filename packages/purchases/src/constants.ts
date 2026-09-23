/**
 * Sentinel expiry for a grant with no end (a lifetime `NON_RENEWING_PURCHASE`).
 * The maximum value `Date` can hold, so `until > now` stays true forever, the
 * value survives JSON, and it is distinguishable from "no access recorded"
 * (`null`). `resolveEntitlement` reports it back to the UI as `until: null`.
 */
export const LIFETIME_UNTIL = 8_640_000_000_000_000;

/** True in development builds (`__DEV__`), false in release and where the global is absent. */
export function isDev(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}
