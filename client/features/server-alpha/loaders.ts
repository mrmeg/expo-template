import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";
import type { TemplateServerExample } from "@/server/api/template/examples";
import type { TemplateServerCatalog } from "@/server/api/template/examples";
import type { TemplateServerStatus } from "@/server/api/template/status";

export type ExampleLoaderData = {
  example: TemplateServerExample | null;
  requestedExample: string | string[] | null;
  status: TemplateServerStatus;
};

export const serverAlphaLoader: LoaderFunction<TemplateServerCatalog> = async (request) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // Static export and direct unit-test calls do not have an active Expo Server request scope.
  }

  const { getTemplateServerCatalog } = await import("@/server/api/template/examples");
  return getTemplateServerCatalog(request);
};

export const serverAlphaExampleLoader: LoaderFunction<ExampleLoaderData> = async (
  request,
  params,
) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // Static export and direct unit-test calls do not have an active Expo Server request scope.
  }

  const [{ getTemplateServerExample }, { getTemplateServerStatus }] =
    await Promise.all([
      import("@/server/api/template/examples"),
      import("@/server/api/template/status"),
    ]);

  return {
    example: getTemplateServerExample(params.example),
    requestedExample: params.example ?? null,
    status: getTemplateServerStatus(request),
  };
};
