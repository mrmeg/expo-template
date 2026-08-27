/**
 * /api/media/[action] — consolidated media API route.
 *
 * Expo exports every `+api.ts` file as its own self-contained server
 * bundle, so sibling routes that share heavy dependencies (here the S3
 * client and auth stack) duplicate them once per file. Grouping the
 * media actions behind one dynamic segment keeps the public URLs
 * (`/api/media/list`, `/api/media/getUploadUrl`, ...) while emitting a
 * single bundle.
 */

import { jsonErrorResponse } from "@/server/api/shared/errors";
import { mediaHandlers } from "@/server/media/handlers";

type MediaParams = { action: string };
type Method = "GET" | "POST" | "DELETE";
type RouteHandler = (request: Request) => Promise<Response>;

const routes: Record<string, Partial<Record<Method, RouteHandler>>> = {
  list: { GET: mediaHandlers.list },
  getUploadUrl: { POST: mediaHandlers.getUploadUrl },
  getSignedUrls: { POST: mediaHandlers.getSignedUrls },
  delete: { DELETE: mediaHandlers.deleteOne, POST: mediaHandlers.deleteMany },
};

function dispatch(
  method: Method,
  request: Request,
  { action }: MediaParams,
): Promise<Response> | Response {
  const route = routes[action];
  if (!route) {
    return jsonErrorResponse(request, 404, {
      code: "not-found",
      message: "Unknown media action",
    });
  }
  const handler = route[method];
  if (!handler) {
    return jsonErrorResponse(request, 405, {
      code: "method-not-allowed",
      message: `${method} is not supported for this media action`,
    });
  }
  return handler(request);
}

export function OPTIONS(request: Request, params: MediaParams) {
  if (!routes[params.action]) {
    return jsonErrorResponse(request, 404, {
      code: "not-found",
      message: "Unknown media action",
    });
  }
  return mediaHandlers.options(request);
}

export function GET(request: Request, params: MediaParams) {
  return dispatch("GET", request, params);
}

export function POST(request: Request, params: MediaParams) {
  return dispatch("POST", request, params);
}

export function DELETE(request: Request, params: MediaParams) {
  return dispatch("DELETE", request, params);
}
