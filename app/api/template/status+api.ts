import { getCorsHeaders, getPreflightHeaders } from "@/server/api/shared/cors";
import { getTemplateServerStatus } from "@/server/api/template/status";

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

export function GET(request: Request) {
  return Response.json(getTemplateServerStatus(request), {
    headers: {
      "Cache-Control": "no-store",
      ...getCorsHeaders(request),
    },
  });
}
