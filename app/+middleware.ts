import { setResponseHeaders } from "expo-server";
import type { MiddlewareSettings } from "expo-server";
import type { MiddlewareFunction } from "expo-router/server";

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

const middleware: MiddlewareFunction = (request) => {
  setResponseHeaders((headers) => {
    headers.set("X-Expo-Router-Middleware", "1");

    if (!request.headers.has("Origin")) {
      return;
    }

    const vary = headers.get("Vary");
    const varyValues = vary?.toLowerCase().split(",").map((value) => value.trim());

    if (!varyValues?.includes("origin")) {
      headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
    }
  });
};

export default middleware;
