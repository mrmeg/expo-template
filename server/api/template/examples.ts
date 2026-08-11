import {
  getTemplateServerStatus,
  type ServerStatusRequest,
  type TemplateServerStatus,
} from "./status";

export type TemplateServerExample = {
  id: "loader-overview" | "dynamic-loader" | "api-route" | "middleware";
  label: string;
  route: string;
  apiPath: string | null;
  loaderPath: string | null;
  pattern: string;
  useCase: string;
  codePointers: string[];
};

export type TemplateServerCatalog = {
  status: TemplateServerStatus;
  examples: TemplateServerExample[];
  generatedAt: string;
};

const EXAMPLES: TemplateServerExample[] = [
  {
    id: "loader-overview",
    label: "Overview Loader",
    route: "/server-alpha",
    apiPath: "/api/template/examples",
    loaderPath: "/_expo/loaders/server-alpha",
    pattern: "Route loader feeds the page its initial data, while an API route exposes the same catalog for client refreshes.",
    useCase: "Landing pages, dashboards, account summaries, and content pages that should show useful data on first load.",
    codePointers: [
      "app/(main)/(demos)/server-alpha/index.tsx",
      "app/api/template/examples+api.ts",
      "server/api/template/examples.ts",
    ],
  },
  {
    id: "dynamic-loader",
    label: "Dynamic Route",
    route: "/server-alpha/dynamic-loader",
    apiPath: "/api/template/examples",
    loaderPath: null,
    pattern: "Route params drive a client fetch of the matching API route; a loader's payload is a build-time snapshot keyed by the route file, so it cannot answer a param'd request.",
    useCase: "Public profiles, docs articles, project detail pages, and shareable report pages.",
    codePointers: [
      "app/(main)/(demos)/server-alpha/[example].tsx",
      "client/features/server-alpha/ServerAlphaExampleScreen.tsx",
      "app/api/template/examples+api.ts",
    ],
  },
  {
    id: "api-route",
    label: "API Route",
    route: "/server-alpha/api-route",
    apiPath: "/api/template/echo",
    loaderPath: "/_expo/loaders/server-alpha/api-route",
    pattern: "Route handlers own request body parsing and mutations; loaders stay read-only and request-scoped.",
    useCase: "Form submits, command endpoints, upload signers, billing sessions, and app-specific BFF calls.",
    codePointers: [
      "app/api/template/echo+api.ts",
      "server/api/template/examples.ts",
    ],
  },
  {
    id: "middleware",
    label: "Middleware",
    route: "/server-alpha/middleware",
    apiPath: "/api/template/status",
    loaderPath: "/_expo/loaders/server-alpha/middleware",
    pattern: "Middleware handles broad response headers and request visibility, while route helpers keep auth and business rules explicit.",
    useCase: "Request IDs, coarse redirects, broad security headers, A/B routing, and low-cost telemetry hooks.",
    codePointers: ["app/+middleware.ts", "server/index.ts"],
  },
];

export function listTemplateServerExamples(): TemplateServerExample[] {
  return EXAMPLES;
}

export function getTemplateServerCatalog(
  request: ServerStatusRequest,
): TemplateServerCatalog {
  return {
    status: getTemplateServerStatus(request),
    examples: listTemplateServerExamples(),
    generatedAt: new Date().toISOString(),
  };
}
