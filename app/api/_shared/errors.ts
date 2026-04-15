/**
 * Shared API error responses for Expo Router routes.
 *
 * Produces consistent JSON error bodies with a discriminated `code`
 * field that the client can map to its own typed problem union.
 */

import { getCorsHeaders } from "./cors";

export interface ApiErrorBody {
  code: string;
  message: string;
  [extra: string]: unknown;
}

export function jsonErrorResponse(
  request: Request,
  status: number,
  body: ApiErrorBody,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

export function unauthorizedResponse(
  request: Request,
  reason = "Missing or invalid credentials",
): Response {
  return jsonErrorResponse(request, 401, {
    code: "unauthorized",
    message: reason,
  });
}

export function forbiddenResponse(
  request: Request,
  reason = "Access denied",
): Response {
  return jsonErrorResponse(request, 403, {
    code: "forbidden",
    message: reason,
  });
}

export function badRequestResponse(
  request: Request,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return jsonErrorResponse(request, 400, { code, message, ...(extra ?? {}) });
}
