import {
  commonChecks,
  runCheckCli,
  UI_PACKAGE,
} from "../../lib/checkKit.mjs";

const AUTH = /^(@\/|(\.\.?\/)+)client\/auth$/;

runCheckCli(import.meta.url, (app, report) => {
  report.check("route-exists", app.hasFile("app/settings.tsx"), "app/settings.tsx was not written");

  report.check(
    "uses-item-rows",
    app.jsxCount(UI_PACKAGE, ["ItemGroup"]) > 0 && app.jsxCount(UI_PACKAGE, ["Item"]) > 0,
    "settings rows are not ItemGroup + Item from @mrmeg/expo-ui",
  );
  report.check(
    "theme-choice",
    app.jsxCount(UI_PACKAGE, ["ThemeSelector", "SegmentedControl", "RadioGroup", "Select", "ToggleGroup"]) > 0,
    "no package control picks the theme (ThemeSelector, SegmentedControl, RadioGroup, Select, ToggleGroup)",
  );
  report.check(
    "notifications-toggle",
    app.jsxCount(UI_PACKAGE, ["Switch", "Checkbox", "Toggle"]) > 0,
    "no package Switch, Checkbox or Toggle",
  );
  report.check(
    "sign-out-confirm",
    app.jsxCount(UI_PACKAGE, ["AlertDialog", "Dialog", "BottomSheet"]) > 0 ||
      (app.imports(UI_PACKAGE, "Alert") && app.memberCallCount("Alert") > 0),
    "no package AlertDialog, Dialog, BottomSheet or Alert asks for confirmation",
  );
  report.check(
    "sign-out-wired",
    app.referenceCount(AUTH, "signOut") > 0,
    "signOut() from @/client/auth is never used",
  );

  // The docs disagree: LLM_USAGE.md says every screen root is Screen, while the
  // Item.md example it calls the complete flat screen roots at a ScrollView.
  report.check("screen-root", app.jsxCount(UI_PACKAGE, ["Screen"]) > 0, "no Screen root", { advisory: true });

  commonChecks(app, report);
});
