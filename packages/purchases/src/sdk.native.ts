/**
 * Native loader for the RevenueCat SDKs (iOS / Android).
 *
 * Both modules are required lazily, inside a function and only after a public
 * key check: an unconfigured build never touches the native module, and a dev
 * client built before the modules were added fails soft (null) instead of
 * crashing at import time. The web twin (`sdk.ts`) always resolves null, which
 * also keeps both SDKs out of the web bundle. Lifted from Mindmap
 * `client/features/pro/purchasesModule.native.ts`; a deferred `require` replaces
 * its `import()` so the loader is also exercisable under Jest, which cannot
 * evaluate a native dynamic import without `--experimental-vm-modules`.
 */
import type { PaywallUi, PurchasesSdk } from "./sdkTypes";

let sdkPromise: Promise<PurchasesSdk | null> | null = null;
let uiPromise: Promise<PaywallUi | null> | null = null;

function load<T>(loader: () => T): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      resolve(loader());
    } catch {
      resolve(null);
    }
  });
}

export function loadPurchasesSdk(): Promise<PurchasesSdk | null> {
  sdkPromise ??= load(() => {
    const mod = require("react-native-purchases") as { default: PurchasesSdk };
    return mod.default;
  });
  return sdkPromise;
}

export function loadPaywallUi(): Promise<PaywallUi | null> {
  uiPromise ??= load(() => {
    const mod = require("react-native-purchases-ui") as { default: PaywallUi };
    return mod.default;
  });
  return uiPromise;
}

/** Test seam: forget the cached modules. */
export function resetSdkCache(): void {
  sdkPromise = null;
  uiPromise = null;
}
