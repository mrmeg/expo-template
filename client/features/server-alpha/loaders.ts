import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";
import type { TemplateServerCatalog } from "@/server/api/template/examples";

/**
 * Web is server-rendered, so this runs **per request** — `expo-server` calls it
 * with the real request before rendering and again for `/_expo/loaders/<route>`
 * on client navigations. There is no build-time snapshot, and loader requests
 * are matched by the route's regex, so params reach a loader too.
 *
 * The route that owns this loader must declare it itself (`export const loader
 * = serverAlphaLoader` in `app/(main)/(demos)/server-alpha/index.tsx`): the
 * export's loader detection ignores specifier re-exports, so a thin
 * `export { serverAlphaLoader as loader } from …` ships no loader in a
 * production build (guarded by `server/__tests__/loaderExportShape.test.ts`).
 *
 * `server-alpha/[example].tsx` still stays loader-less on purpose: fetching the
 * paired API route is the one data path that works on every rendering mode,
 * including native and a static (non-server) web export, where a param'd
 * loader has no addressable payload (see `ServerAlphaExampleScreen`).
 */
export const serverAlphaLoader: LoaderFunction<TemplateServerCatalog> = async (request) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // Static export and direct unit-test calls do not have an active Expo Server request scope.
  }

  const { getTemplateServerCatalog } = await import("@/server/api/template/examples");
  return getTemplateServerCatalog(request);
};
