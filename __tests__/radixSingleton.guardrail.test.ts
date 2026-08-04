/**
 * Radix dependency-graph guardrails for `(main)`-route SSR.
 *
 * Why this file exists
 * -------------------
 * `app/(main)/(tabs)/_layout.tsx` renders `NativeTabs`, whose web
 * implementation (`expo-router/build/native-tabs/NativeTabsView.web.js`) is
 * built on `@radix-ui/react-tabs`. Because `MainLayout` sets
 * `initialRouteName: "(tabs)"`, that Radix tree renders during SSR of *every*
 * `(main)` route — including all `(demos)/*`. And because
 * `@expo/router-server`'s streaming renderer only `console.error`s an
 * `onError` (`renderStreamingContent.js`), a render-time throw there produces a
 * blank/truncated **200**, not a 500. A silent blank page is the failure mode.
 *
 * The classic way to make a Radix tree throw is a duplicated Radix module:
 * two copies of a context provider means the consumer reads the *other* copy's
 * empty context, and two copies of `Slot` is the documented
 * `React.Children.only` crash surface (it bit the web AlertDialog before).
 *
 * What was actually found
 * ----------------------
 * A blank SSR body on `/screen-faq` was observed once during earlier work, but
 * that session had a corrupted half-install. Re-checked against a clean install
 * and a real production server (`bun run build && bun run start`), the blank
 * body does **not** reproduce: `/`, `/screen-faq`, `/settings`, `/profile`, and
 * `/media` all return real route markup, warm and cold, with zero
 * `SSR streaming render error:` lines.
 *
 * The browser pass did reproduce a *different*, real crash from the same
 * duplicate-module family: clicking the showcase **AlertDialog** trigger threw
 * `React.Children.only expected to receive a single React element child` and
 * tripped the error boundary. Mechanism, confirmed by loading the copies side
 * by side:
 *
 *   `react-slot`'s `isSlottable(child)` tests
 *   `child.type.__radixId === SLOTTABLE_IDENTIFIER`, and
 *   `SLOTTABLE_IDENTIFIER` is `Symbol("radix.slottable")` — **not**
 *   `Symbol.for(...)`. So the identifier is unique per *physical copy* of the
 *   package. `AlertDialogContent` built its `Slottable` from its own nested
 *   copy, while the `Slot` doing the matching came through
 *   `react-primitive`'s copy. `isSlottable` returned false, the real child fell
 *   through to `SlotClone` with more than one child, and
 *   `React.Children.count(children) > 1` hit `React.Children.only(null)`.
 *
 * Fix: `package.json` `overrides` pin `@radix-ui/react-slot` to `1.2.4` and
 * `@radix-ui/react-primitive` to `2.1.4` (the higher of each pair — both splits
 * were a single patch apart). After `bun install` there is exactly one copy of
 * each on disk and no nested keys in `bun.lock`, so every Radix package shares
 * one `SLOTTABLE_IDENTIFIER`.
 *
 * Note `overrides` is the right lever, not Metro's `dedupePackages`
 * (`metro.config.js`): that rewrites only the **Metro** bundle, while SSR here
 * runs the exported server bundle. `overrides` reaches both.
 *
 * Reading the lockfile is deliberate — it is the source of truth Bun installs
 * from, and this stays a cheap source check in the style of
 * `ssrHydration.guardrail.test.ts` (no heavy mocks, no install).
 */
import { readFileSync } from "fs";
import { join } from "path";

const lock = readFileSync(join(__dirname, "..", "bun.lock"), "utf8");

/**
 * Every resolution of `pkg` in `bun.lock`, split into the hoisted entry and any
 * nested ones. Bun keys a hoisted package as `"<pkg>"` and a nested copy as
 * `"<parent>/<pkg>"`, each mapping to `["<pkg>@<version>", ...]`.
 */
function resolutionsOf(pkg: string): { hoisted: string | null; nested: { parent: string; version: string }[] } {
  const pattern = new RegExp(`^\\s*"((?:([^"]+)/)?${pkg.replace("/", "\\/")})": \\["${pkg.replace("/", "\\/")}@([^"]+)"`, "gm");
  let hoisted: string | null = null;
  const nested: { parent: string; version: string }[] = [];

  for (const match of lock.matchAll(pattern)) {
    const [, , parent, version] = match;
    if (parent) nested.push({ parent, version });
    else hoisted = version;
  }
  return { hoisted, nested };
}

/** Distinct versions of `pkg` present anywhere in the lockfile. */
function versionsOf(pkg: string): string[] {
  const { hoisted, nested } = resolutionsOf(pkg);
  const all = [...(hoisted ? [hoisted] : []), ...nested.map((n) => n.version)];
  return [...new Set(all)].sort();
}

describe("Radix singleton guardrails for (main)-route SSR", () => {
  // The modules the SSR-rendered Radix Tabs tree actually goes through. Each
  // carries React context or a collection registry, so a second copy means a
  // consumer reads an empty context and the (main) SSR body goes blank.
  describe.each([
    "@radix-ui/react-tabs",
    "@radix-ui/react-direction",
    "@radix-ui/react-context",
    "@radix-ui/react-roving-focus",
    "@radix-ui/react-collection",
    "@radix-ui/react-presence",
    "@radix-ui/react-id",
  ])("%s renders in the SSR Tabs tree", (pkg) => {
    it("resolves to exactly one version (a split can blank (main) SSR)", () => {
      expect(versionsOf(pkg)).toHaveLength(1);
    });

    it("has no nested copies in bun.lock", () => {
      // Cheapest signal: any `"<parent>/<pkg>"` key is a second copy on disk.
      expect(resolutionsOf(pkg).nested).toEqual([]);
    });
  });

  // The two packages that WERE split and caused the AlertDialog
  // `React.Children.only` crash. Unified via `package.json` overrides; a second
  // copy of either reintroduces a distinct `Symbol("radix.slottable")` and the
  // crash comes back.
  describe.each([
    ["@radix-ui/react-slot", "1.2.4"],
    ["@radix-ui/react-primitive", "2.1.4"],
  ])("%s is pinned by package.json overrides", (pkg, version) => {
    it(`resolves to exactly one version (${version})`, () => {
      expect(versionsOf(pkg)).toEqual([version]);
    });

    it("has no nested copies (a second copy breaks Slottable identity)", () => {
      expect(resolutionsOf(pkg).nested).toEqual([]);
    });
  });

  // The override is what holds the dedupe: Metro's dedupePackages only rewrites
  // the Metro bundle, and SSR runs the exported server bundle.
  describe("package.json declares the overrides that keep them unified", () => {
    const pkgJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      overrides?: Record<string, string>;
    };

    it.each([
      ["@radix-ui/react-slot", "1.2.4"],
      ["@radix-ui/react-primitive", "2.1.4"],
    ])("pins %s to %s", (pkg, version) => {
      expect(pkgJson.overrides?.[pkg]).toBe(version);
    });
  });
});
