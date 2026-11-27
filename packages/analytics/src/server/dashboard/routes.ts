/**
 * `GET <basePath>/` serves the dashboard page and `GET <basePath>/assets/*`
 * its script and stylesheet, all admin-only like the API they read. The
 * assets are separate files rather than inline so a strict
 * Content-Security-Policy (`script-src 'self'; style-src 'self'`) allows them.
 */
import { normalizeBasePath, type Route } from "../http";
import { DASHBOARD_CSP, renderDashboardPage } from "./page";
import { DASHBOARD_SCRIPT } from "./script";
import { DASHBOARD_STYLES } from "./styles";

/** Private and possibly stale the moment the data moves, so never cached; never indexed or leaked by referrer. */
const PRIVATE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "same-origin",
};

function asset(body: string, contentType: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": contentType, ...PRIVATE_HEADERS } });
}

export const DASHBOARD_ROUTES: readonly Route[] = [
  {
    method: "GET",
    pattern: "/",
    access: "admin",
    handler: async (ctx) =>
      new Response(renderDashboardPage(normalizeBasePath(ctx.config.basePath)), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": DASHBOARD_CSP, ...PRIVATE_HEADERS },
      }),
  },
  {
    method: "GET",
    pattern: "/assets/dashboard.js",
    access: "admin",
    handler: async () => asset(DASHBOARD_SCRIPT, "text/javascript; charset=utf-8"),
  },
  {
    method: "GET",
    pattern: "/assets/dashboard.css",
    access: "admin",
    handler: async () => asset(DASHBOARD_STYLES, "text/css; charset=utf-8"),
  },
];
