import { getCorsHeaders, getPreflightHeaders } from "@/server/api/shared/cors";
import { getTemplateServerCatalog } from "@/server/api/template/examples";

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

export function GET(request: Request) {
  return Response.json(getTemplateServerCatalog(request), {
    headers: {
      "Cache-Control": "no-store",
      ...getCorsHeaders(request),
    },
  });
}
