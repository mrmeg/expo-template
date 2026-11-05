import { commonChecks, runCheckCli, UI_PACKAGE } from "../../lib/checkKit.mjs";

const MEDIA = /^@mrmeg\/expo-media(\/.*)?$/;
const MEDIA_PICKER = /^@mrmeg\/expo-media\/picker$/;
const MEDIA_CLIENT = /^@mrmeg\/expo-media(\/client)?$/;
const MEDIA_QUEUE = /^@mrmeg\/expo-media\/upload-queue$/;
const MEDIA_QUERY = /^@mrmeg\/expo-media\/react-query$/;
const HAND_ROLLED_PICKERS = new Set(["expo-image-picker", "expo-document-picker"]);

runCheckCli(import.meta.url, (app, report) => {
  report.check("route-exists", app.hasFile("app/photos.tsx"), "app/photos.tsx was not written");

  const pickers = app.importedNames(MEDIA_PICKER);
  report.check(
    "picks-with-package",
    pickers.has("useMediaPicker") || pickers.has("pickMedia"),
    "photos are not picked with useMediaPicker or pickMedia from @mrmeg/expo-media/picker",
  );
  report.check(
    "uploads-with-package",
    app.imports(MEDIA_QUEUE, "useUploadQueue") ||
      (app.imports(MEDIA_QUERY, "createMediaQueryHooks") && app.textMatches(/\buseMediaUpload\b/)),
    "uploads do not go through useUploadQueue or the useMediaUpload mutation",
  );
  report.check(
    "media-client-endpoint",
    app.imports(MEDIA_CLIENT, "createMediaClient") && app.textMatches(/api\.example\.test\/api\/media/),
    "no createMediaClient pointed at https://api.example.test/api/media",
  );
  report.check(
    "package-grid",
    app.jsxCount(UI_PACKAGE, ["MediaGrid", "MediaTile", "UploadQueue"]) > 0,
    "the grid is not MediaGrid / MediaTile / UploadQueue from @mrmeg/expo-ui",
  );
  report.check(
    "no-hand-rolled-upload",
    !app.specifiers().some((specifier) => HAND_ROLLED_PICKERS.has(specifier)) &&
      !app.textMatches(/\buploadAsync\b|\bXMLHttpRequest\b|new FormData\(/),
    "picks or uploads with expo-image-picker, FormData, or uploadAsync instead of @mrmeg/expo-media",
  );
  report.check("retry-failed", app.textMatches(/\bretry\b|\bonRetry\b/), "no way to retry a failed upload");
  report.check("uses-media-package", app.specifiers().some((specifier) => MEDIA.test(specifier)), "never imports @mrmeg/expo-media");

  report.check("screen-root", app.jsxCount(UI_PACKAGE, ["Screen"]) > 0, "no Screen root", { advisory: true });

  commonChecks(app, report);
});
