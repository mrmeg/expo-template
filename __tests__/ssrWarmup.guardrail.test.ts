/**
 * SSR warm-up and blank-recovery wiring guardrails.
 *
 * Same idea as ssrHydration.guardrail.test.ts: cheap source checks so a fork
 * can't silently drop the wiring. The behaviors these protect:
 *
 * - server.bun.ts warms BOTH SSR trees at boot (onboarding gate and the
 *   cookied returning-visitor tree) and gates HTML rendering on that warm-up,
 *   so no visitor races a cold render (~9s TTFB and a module graph still
 *   loading — the observed blank-screen trigger window).
 * - app/+html.tsx ships the blank-screen recovery watchdog in <head>, before
 *   the app scripts, so a dead hydration still self-heals and reports.
 *
 * The watchdog's runtime behavior is covered in blankRecovery.test.ts.
 */
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("server.bun.ts SSR warm-up gate", () => {
  const src = read("server.bun.ts");

  it("warms the cookied returning-visitor tree, not just the onboarding gate", () => {
    expect(src).toMatch(/Cookie:\s*"has-seen-onboarding=1"/);
  });

  it("drains the warm-up response body so suspended chunks actually render", () => {
    expect(src).toMatch(/await response\.text\(\)/);
  });

  it("keeps serving when the warm-up fails", () => {
    expect(src).toMatch(/ssrWarmup[\s\S]*?\.catch\(/);
  });

  it("gates the SSR render path on the warm-up", () => {
    const gate = src.indexOf("await ssrWarmup");
    const render = src.indexOf("expoRequestHandler(loaderNormalizedRequest(request))");
    expect(gate).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(render);
  });

  it("does not gate API routes on the warm-up", () => {
    expect(src).toMatch(/!routeMatches\(url\.pathname, "\/api"\)/);
  });
});

describe("app/+html.tsx blank-screen recovery watchdog", () => {
  const html = read("app/+html.tsx");

  it("renders the watchdog script in the document head", () => {
    expect(html).toContain("<script>{BLANK_RECOVERY_SCRIPT}</script>");
    expect(html).toMatch(/import \{ BLANK_RECOVERY_SCRIPT \} from "@\/client\/features\/app\/blankRecoveryScript"/);
  });

  it("keeps the watchdog ahead of the app scripts (head, before body children)", () => {
    const script = html.indexOf("{BLANK_RECOVERY_SCRIPT}");
    const body = html.indexOf("<body {...bodyAttributes}>");
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(body);
  });
});
