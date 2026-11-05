import { commonChecks, runCheckCli, UI_PACKAGE } from "../../lib/checkKit.mjs";

const ROOT = /^@mrmeg\/expo-purchases$/;
const SDK = /^react-native-purchases(-ui)?$/;
const SERVER = /^@mrmeg\/expo-purchases\/server$/;

runCheckCli(import.meta.url, (app, report) => {
  report.check("route-exists", app.hasFile("app/pro-report.tsx"), "app/pro-report.tsx was not written");

  report.check(
    "gates-with-package",
    app.jsxCount(ROOT, ["PaywallGate"]) > 0 ||
      app.callCount(ROOT, "useRequireEntitlement") > 0 ||
      app.callCount(ROOT, "useEntitlement") > 0,
    "the screen is not gated with PaywallGate, useRequireEntitlement or useEntitlement from @mrmeg/expo-purchases",
  );
  report.check("provider-mounted", app.jsxCount(ROOT, ["PurchasesProvider"]) > 0, "PurchasesProvider is never mounted");
  report.check(
    "client-and-store",
    app.callCount(ROOT, "createPurchases") > 0 && app.callCount(ROOT, "createEntitlementStore") > 0,
    "createPurchases and createEntitlementStore are not both called",
  );
  report.check(
    "pro-entitlement",
    app.textMatches(/entitlement:\s*["']pro["']/),
    "createPurchases is not given the `pro` entitlement",
  );
  report.check(
    "keys-from-env",
    app.textMatches(/process\.env\.EXPO_PUBLIC_RC_IOS_KEY/) && app.textMatches(/process\.env\.EXPO_PUBLIC_RC_ANDROID_KEY/),
    "the RevenueCat keys are not read from the named env vars",
  );
  report.check(
    "provider-user",
    app.textMatches(/\buseAuth\b/) && app.textMatches(/userId\s*=\s*\{/),
    "PurchasesProvider is not given the signed-in user's id",
  );
  report.check(
    "no-sdk-or-server-imports",
    !app.specifiers().some((specifier) => SDK.test(specifier) || SERVER.test(specifier)),
    "imports react-native-purchases directly, or @mrmeg/expo-purchases/server into the app",
  );
  report.check(
    "paywall-offered",
    app.textMatches(/\bpresentPaywall(IfNeeded)?\b|\bonBlocked\b|\bfallback\s*=/),
    "nothing offers the paywall to users without pro",
  );

  report.check("screen-root", app.jsxCount(UI_PACKAGE, ["Screen"]) > 0, "no Screen root", { advisory: true });

  commonChecks(app, report);
});
