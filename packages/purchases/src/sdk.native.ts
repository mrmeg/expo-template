/**
 * Native loader for the RevenueCat SDKs (iOS / Android).
 *
 * Each module is required lazily, inside a function and only after a public key
 * check: an unconfigured build never touches the native module, and a dev
 * client built before the modules were added fails soft (null) instead of
 * crashing at import time. The web twin (`sdk.ts`) always resolves null, which
 * also keeps both SDKs out of the web bundle. Lifted from Mindmap
 * `client/features/pro/purchasesModule.native.ts`; a deferred `require`
 * replaces its `import()` so the loader is also exercisable under Jest, which
 * cannot evaluate a native dynamic import without `--experimental-vm-modules`.
 *
 * Each `require` sits lexically inside its own `try` block: that is the shape
 * Expo's Metro transformer (`allowOptionalDependencies`) recognises as an
 * optional dependency, so a native consumer that installs only
 * `react-native-purchases` (custom paywall, no `-ui`) still bundles.
 */
import type { PaywallUi, PurchasesSdk } from "./sdkTypes";

function requirePurchasesSdk(): PurchasesSdk | null {
  try {
    return (require("react-native-purchases") as { default: PurchasesSdk }).default ?? null;
  } catch {
    return null;
  }
}

function requirePaywallUi(): PaywallUi | null {
  try {
    return (require("react-native-purchases-ui") as { default: PaywallUi }).default ?? null;
  } catch {
    return null;
  }
}

export function loadPurchasesSdk(): Promise<PurchasesSdk | null> {
  return Promise.resolve(requirePurchasesSdk());
}

export function loadPaywallUi(): Promise<PaywallUi | null> {
  return Promise.resolve(requirePaywallUi());
}
