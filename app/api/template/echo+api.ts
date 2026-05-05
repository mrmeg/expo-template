import { getCorsHeaders, getPreflightHeaders } from "@/server/api/shared/cors";
import { getTemplateServerStatus } from "@/server/api/template/status";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: getPreflightHeaders(request),
  });
}

export async function POST(request: Request) {
  return Response.json(
    {
      status: getTemplateServerStatus(request),
      echoedAt: new Date().toISOString(),
      body: await readJsonBody(request),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ...getCorsHeaders(request),
      },
    },
  );
}
