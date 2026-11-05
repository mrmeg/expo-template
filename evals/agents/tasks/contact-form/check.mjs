import { commonChecks, runCheckCli, UI_PACKAGE } from "../../lib/checkKit.mjs";

const CONTACT_API = /^(@\/|(\.\.?\/)+)client\/api\/contact$/;

runCheckCli(import.meta.url, (app, report) => {
  report.check("route-exists", app.hasFile("app/contact.tsx"), "app/contact.tsx was not written");

  report.check("form-fields", app.jsxCount(UI_PACKAGE, ["TextInput"]) > 0, "the fields are not the package TextInput");
  report.check(
    "field-errors",
    app.textMatches(/\berrorText\s*=/),
    "no field passes errorText, the package's per-field error slot",
  );
  report.check(
    "validates-email",
    app.textMatches(/\.test\(|\.match\(|includes\(["']@["']\)|indexOf\(["']@["']\)|\.email\(/),
    "no email check",
  );
  report.check("submit-button", app.jsxCount(UI_PACKAGE, ["Button"]) > 0, "no package Button submits the form");
  report.check(
    "submits-contact",
    app.referenceCount(CONTACT_API, "submitContact") > 0,
    "submitContact() from @/client/api/contact is never used",
  );
  report.check(
    "success-toast",
    app.memberCallCount("notify", ["success", "promise"]) > 0 ||
      (app.callCount(UI_PACKAGE, "notify") > 0 && app.textMatches(/type:\s*["']success["']/)),
    "no notify.success toast on submit",
  );

  report.check("screen-root", app.jsxCount(UI_PACKAGE, ["Screen"]) > 0, "no Screen root", { advisory: true });

  commonChecks(app, report);
});
