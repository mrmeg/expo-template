import { setResponseHeaders } from "expo-server";
import type { MiddlewareSettings } from "expo-server";
import type { MiddlewareFunction } from "expo-router/server";

import { applyCorsHeaders, isCorsPath } from "@/server/api/shared/cors";

export const unstable_settings: MiddlewareSettings = {
  matcher: {
    patterns: [
      "/api",
      "/api/[...path]",
      "/server-alpha",
      "/server-alpha/[example]",
      "/(main)/(demos)/server-alpha",
      "/(main)/(demos)/server-alpha/[example]",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  },
};

/**
 * Tags matched responses and applies the shared CORS policy
 * (`server/api/shared/cors.ts`) to every `/api` response — including the 405s
 * Expo Server writes itself — so API routes carry the same CORS headers in
 * every runtime: the dev server, `expo serve`, and the Bun server, which
 * applies the same policy again.
 */
const middleware: MiddlewareFunction = (request) => {
  setResponseHeaders((headers) => {
    headers.set("X-Expo-Router-Middleware", "1");

    if (isCorsPath(new URL(request.url).pathname)) {
      applyCorsHeaders(request, headers);
    }
  });
};

export default middleware;
