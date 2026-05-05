import { environment, origin } from "expo-server";
import type { ImmutableRequest } from "expo-server";

export type TemplateServerStatus = {
  ok: true;
  servedAt: string;
  request: {
    method: string;
    path: string | null;
    hasRequest: boolean;
    originHeader: string | null;
    userAgent: string | null;
  };
  runtime: {
    mode: "server" | "static";
    environment: string | null;
    origin: string | null;
    nodeEnv: string | null;
  };
};

export type ServerStatusRequest = Request | ImmutableRequest | undefined;

function safeRuntimeValue(read: () => string | null): string | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function getPath(request: ServerStatusRequest): string | null {
  if (!request) {
    return null;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

export function getTemplateServerStatus(
  request: ServerStatusRequest,
): TemplateServerStatus {
  return {
    ok: true,
    servedAt: new Date().toISOString(),
    request: {
      method: request?.method ?? "STATIC",
      path: getPath(request),
      hasRequest: Boolean(request),
      originHeader: request?.headers.get("Origin") ?? null,
      userAgent: request?.headers.get("User-Agent") ?? null,
    },
    runtime: {
      mode: request ? "server" : "static",
      environment: safeRuntimeValue(environment),
      origin: safeRuntimeValue(origin),
      nodeEnv: process.env.NODE_ENV ?? null,
    },
  };
}
