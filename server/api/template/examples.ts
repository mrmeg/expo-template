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
    pattern: "Route loader hydrates an SSR page, while an API route exposes the same catalog for client refreshes.",
    useCase: "Landing pages, dashboards, account summaries, and content pages that should render useful data before hydration.",
    codePointers: [
      "app/(main)/(demos)/server-alpha.tsx",
      "app/api/template/examples+api.ts",
      "server/api/template/examples.ts",
    ],
  },
  {
    id: "dynamic-loader",
    label: "Dynamic Loader",
    route: "/server-alpha/dynamic-loader",
    apiPath: null,
    loaderPath: "/_expo/loaders/server-alpha/dynamic-loader",
    pattern: "Dynamic route params flow into a typed loader and return JSON-serializable data for the page.",
    useCase: "Public profiles, docs articles, project detail pages, and shareable report pages.",
    codePointers: ["app/(main)/(demos)/server-alpha/[example].tsx"],
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

export function getTemplateServerExample(
  id: string | string[] | null | undefined,
): TemplateServerExample | null {
  const normalizedId = Array.isArray(id) ? id[0] : id;
  return EXAMPLES.find((example) => example.id === normalizedId) ?? null;
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
