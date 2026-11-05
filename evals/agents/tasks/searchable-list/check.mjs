import { commonChecks, runCheckCli, UI_PACKAGE } from "../../lib/checkKit.mjs";

const PEOPLE_API = /^(@\/|(\.\.?\/)+)client\/api\/people$/;

runCheckCli(import.meta.url, (app, report) => {
  report.check("route-exists", app.hasFile("app/people.tsx"), "app/people.tsx was not written");

  report.check(
    "fetches-people",
    app.referenceCount(PEOPLE_API, "fetchPeople") > 0,
    "fetchPeople() from @/client/api/people is never used",
  );
  report.check("search-field", app.jsxCount(UI_PACKAGE, ["TextInput"]) > 0, "the search box is not the package TextInput");
  report.check(
    "loading-state",
    app.jsxCount(UI_PACKAGE, ["Skeleton", "SkeletonText", "SkeletonAvatar", "SkeletonCard", "Progress"]) > 0,
    "no Skeleton or Progress placeholder for loading",
  );
  report.check(
    "empty-and-error-state",
    app.jsxCount(UI_PACKAGE, ["EmptyState"]) > 0,
    "no package EmptyState for the empty or error region",
  );
  report.check(
    "list-rows",
    app.jsxCount(UI_PACKAGE, ["Item", "Card"]) > 0,
    "rows are neither Item nor Card (one Card per entry is allowed)",
  );
  report.check(
    "retry-action",
    app.textMatches(/\b(onAction|onPress|onRetry)\b/) && app.textMatches(/\b(retry|try again|refetch|attempt)\b/i),
    "no way to try again after a failure",
  );

  report.check("screen-root", app.jsxCount(UI_PACKAGE, ["Screen"]) > 0, "no Screen root", { advisory: true });

  commonChecks(app, report);
});
