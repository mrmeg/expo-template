import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";
import type { TemplateServerCatalog } from "@/server/api/template/examples";

/**
 * Loaders belong on static routes only. Web routes are client-rendered, so
 * `expo export` runs each loader once during the export and keys the payload by
 * the route's file path — fine for `server-alpha/index.tsx`, useless for
 * `server-alpha/[example].tsx`, whose snapshot would sit at `.../[example]`
 * while the browser asks for the substituted path. Param'd routes fetch an API
 * route instead (see `ServerAlphaExampleScreen`).
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
