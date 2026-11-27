/**
 * Runs the dashboard page and script in jsdom against a real
 * `AnalyticsServer`, with the page's `fetch` routed to `server.handle`. Not a
 * test file. jsdom is the copy Jest's jsdom environment already installs; no
 * other browser is available to these tests.
 */
import { JSDOM } from "jsdom";

import type { AnalyticsServer } from "../../server";
import { DASHBOARD_SCRIPT } from "../script";

export interface OpenOptions {
  /** Page URL, query and hash included. */
  url?: string;
  /** Whether API requests carry the admin header; read per request, so a test can end the session. */
  admin?: () => boolean;
}

export interface Dashboard {
  dom: JSDOM;
  window: JSDOM["window"];
  document: Document;
  /** Every API path the page requested, in order. */
  requests: string[];
  /** Errors the page's code threw where nothing caught them. */
  errors: unknown[];
  section(id: string): HTMLElement;
  /** Resolves once `ready` holds, polling the page between macrotasks. */
  until(ready: () => boolean, what: string): Promise<void>;
  goTo(tab: string): Promise<void>;
}

export async function openDashboard(server: AnalyticsServer, options: OpenOptions = {}): Promise<Dashboard> {
  const url = options.url ?? "https://api.example.com/analytics/";
  const admin = options.admin ?? (() => true);
  const page = await server.handle(new Request(url, { headers: { "x-admin": "1" } }));
  if (!page || page.status !== 200) throw new Error(`the page answered ${page?.status}`);
  const dom = new JSDOM(await page.text(), { url, runScripts: "outside-only", pretendToBeVisual: true });
  const window = dom.window;
  const requests: string[] = [];
  const errors: unknown[] = [];
  window.addEventListener("error", (event) => errors.push(event.error ?? event.message));

  // The script reads status, ok, redirected, headers.get and json(); nothing else.
  (window as unknown as { fetch: unknown }).fetch = async (input: string) => {
    const target = new URL(String(input), url);
    requests.push(target.pathname + target.search);
    const response = await server.handle(new Request(target, { headers: admin() ? { "x-admin": "1" } : {} }));
    if (!response) throw new TypeError("outside the base path");
    const body = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      redirected: false,
      headers: { get: (name: string) => response.headers.get(name) },
      json: async () => JSON.parse(body),
    };
  };

  window.eval(DASHBOARD_SCRIPT);

  const until = async (ready: () => boolean, what: string) => {
    for (let i = 0; i < 400; i++) {
      if (ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const section = (id: string) => window.document.getElementById(`section-${id}`) as HTMLElement;
  const loaded = (id: string) => {
    const body = section(id).querySelector("[data-body]");
    return !!body && body.getAttribute("aria-busy") !== "true" && !!body.firstChild && !body.querySelector(".loading");
  };

  return {
    dom,
    window,
    document: window.document,
    requests,
    errors,
    section,
    until,
    async goTo(tab: string) {
      window.location.hash = `#${tab}`;
      await until(() => !section(tab).hidden && loaded(tab), `the ${tab} section`);
    },
  };
}

/** Visible text with whitespace collapsed, for `toContain` checks. */
export function textOf(node: Element): string {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}
