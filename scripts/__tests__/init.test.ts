/**
 * Unit tests for the project init CLI's pure helpers.
 *
 * Mirrors `generate.test.ts`: the interactive prompt loop, the `.env` write,
 * the `rm`s, and the `expo prebuild` invocation are all deliberately out of
 * scope — they need a TTY or mutate the checked-in tree. Everything that can
 * silently produce a broken project is covered here: default derivation,
 * identity validation (delegated to `getAppIdentity()`), `.env` rewriting,
 * the prune plan's route-file resolution, and the `screens.test.tsx` surgery.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  IDENTITY_ENV_KEYS,
  buildEnvUpdates,
  buildPrunePlan,
  collectTemplateReferences,
  deriveIdentityDefaults,
  parseArgs,
  parseAuthChoice,
  parseTemplateMeta,
  parseTemplateSelection,
  readSourceFiles,
  resolveIdentityFromOptions,
  resolvePrunePlan,
  rewriteEnvContent,
  routeFileForTemplate,
  stripTemplateTests,
  toReverseDns,
  toScheme,
  toSlug,
  validateIdentity,
  validateIdentityValue,
} from "../init";

// ---------------------------------------------------------------------------
// Default derivation
// ---------------------------------------------------------------------------

describe("toSlug", () => {
  it("kebab-cases spaced, PascalCase, and punctuated names", () => {
    expect(toSlug("Acme")).toBe("acme");
    expect(toSlug("Acme Corp")).toBe("acme-corp");
    expect(toSlug("AcmeCorp")).toBe("acme-corp");
    expect(toSlug("Acme's App!")).toBe("acme-s-app");
    expect(toSlug("  Acme  Corp  ")).toBe("acme-corp");
  });

  it("never emits leading or trailing hyphens", () => {
    expect(toSlug("!Acme!")).toBe("acme");
    expect(toSlug("--Acme--")).toBe("acme");
  });
});

describe("toScheme", () => {
  it("reuses the slug when it already starts with a letter", () => {
    expect(toScheme("acme-corp")).toBe("acme-corp");
  });

  it("prefixes digit-leading slugs so the RFC 3986 scheme rule holds", () => {
    // Schemes must match ^[a-z][a-z0-9+\-.]*$ — "3d-app" would throw at
    // config load, so the derived default has to be valid on its own.
    expect(toScheme("3d-app")).toBe("app-3d-app");
    expect(validateIdentityValue("scheme", toScheme("3d-app"))).toBeNull();
  });
});

describe("toReverseDns", () => {
  it("builds com.<sanitized-name> with separators stripped", () => {
    expect(toReverseDns("Acme")).toBe("com.acme");
    expect(toReverseDns("Acme Corp")).toBe("com.acmecorp");
    expect(toReverseDns("Acme-Corp!")).toBe("com.acmecorp");
  });

  it("keeps every segment letter-initial for the reverse-DNS rule", () => {
    expect(toReverseDns("3D Labs")).toBe("com.app3dlabs");
    expect(validateIdentityValue("iosBundleIdentifier", toReverseDns("3D Labs"))).toBeNull();
  });
});

describe("deriveIdentityDefaults", () => {
  it("derives all four remaining fields from the name", () => {
    expect(deriveIdentityDefaults("Acme Corp")).toEqual({
      name: "Acme Corp",
      slug: "acme-corp",
      scheme: "acme-corp",
      iosBundleIdentifier: "com.acmecorp",
      androidPackage: "com.acmecorp",
    });
  });

  it("produces a set that passes getAppIdentity()'s validation", () => {
    for (const name of ["Acme", "Acme Corp", "AcmeCorp", "My App 2", "3D Labs"]) {
      expect(validateIdentity(deriveIdentityDefaults(name))).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Identity validation (borrowed from app.identity.js)
// ---------------------------------------------------------------------------

describe("validateIdentityValue", () => {
  it("rejects blank values instead of silently falling back to template defaults", () => {
    expect(validateIdentityValue("slug", "")).toContain("EXPO_PUBLIC_APP_SLUG");
    expect(validateIdentityValue("slug", "   ")).toContain("cannot be blank");
  });

  it("accepts a well-formed set", () => {
    expect(validateIdentityValue("name", "Acme Corp")).toBeNull();
    expect(validateIdentityValue("slug", "acme-corp")).toBeNull();
    expect(validateIdentityValue("scheme", "acme")).toBeNull();
    expect(validateIdentityValue("iosBundleIdentifier", "com.acme.app")).toBeNull();
    expect(validateIdentityValue("androidPackage", "com.acme.app")).toBeNull();
  });

  it("surfaces getAppIdentity()'s own error copy for malformed values", () => {
    expect(validateIdentityValue("slug", "Acme Corp")).toContain("Invalid app slug");
    expect(validateIdentityValue("scheme", "1acme")).toContain("Invalid app scheme");
    expect(validateIdentityValue("iosBundleIdentifier", "acme")).toContain(
      "Invalid iosBundleIdentifier",
    );
    expect(validateIdentityValue("androidPackage", "com.acme-app")).toContain(
      "Invalid androidPackage",
    );
  });

  it("leaves the name unvalidated beyond non-blankness", () => {
    expect(validateIdentityValue("name", "Acme! Corp (v2)")).toBeNull();
  });
});

describe("validateIdentity", () => {
  it("reports every malformed field, not just the first", () => {
    const errors = validateIdentity({
      name: "Acme",
      slug: "Acme",
      scheme: "1acme",
      iosBundleIdentifier: "acme",
      androidPackage: "acme",
    });
    expect(errors).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// .env rewriting
// ---------------------------------------------------------------------------

const ENV_EXAMPLE_FIXTURE = [
  "EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1",
  "",
  "# App identity — leave blank to keep the template defaults.",
  "EXPO_PUBLIC_APP_NAME=\"\"",
  "EXPO_PUBLIC_APP_SLUG=\"\"",
  "EXPO_PUBLIC_APP_SCHEME=\"\"",
  "EXPO_PUBLIC_APP_IOS_BUNDLE_ID=\"\"",
  "EXPO_PUBLIC_APP_ANDROID_PACKAGE=\"\"",
  "",
  "EXPO_PUBLIC_AUTH_PROVIDER=\"\"",
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=\"\"",
  "EXPO_PUBLIC_USER_POOL_ID=\"\"",
  "",
  "# Billing return-URL origin — NOT part of app identity.",
  "EXPO_PUBLIC_APP_URL=\"\"",
  "",
].join("\n");

describe("rewriteEnvContent", () => {
  it("replaces only the targeted keys and preserves comments and order", () => {
    const result = rewriteEnvContent(ENV_EXAMPLE_FIXTURE, {
      EXPO_PUBLIC_APP_NAME: "Acme",
      EXPO_PUBLIC_APP_SLUG: "acme",
    });

    expect(result).toContain("EXPO_PUBLIC_APP_NAME=\"Acme\"");
    expect(result).toContain("EXPO_PUBLIC_APP_SLUG=\"acme\"");
    expect(result).toContain("# App identity — leave blank to keep the template defaults.");
    expect(result).toContain("EXPO_PUBLIC_APP_SCHEME=\"\"");
    expect(result.split("\n")).toHaveLength(ENV_EXAMPLE_FIXTURE.split("\n").length);
  });

  it("leaves EXPO_PUBLIC_APP_URL alone — it is a billing var, not identity", () => {
    const result = rewriteEnvContent(
      ENV_EXAMPLE_FIXTURE,
      buildEnvUpdates(deriveIdentityDefaults("Acme"), "clerk"),
    );
    expect(result).toContain("EXPO_PUBLIC_APP_URL=\"\"");
  });

  it("does not touch commented-out lines that mention the key", () => {
    const source = "# EXPO_PUBLIC_APP_NAME=\"old\"\nEXPO_PUBLIC_APP_NAME=\"\"\n";
    const result = rewriteEnvContent(source, { EXPO_PUBLIC_APP_NAME: "Acme" });
    expect(result).toBe("# EXPO_PUBLIC_APP_NAME=\"old\"\nEXPO_PUBLIC_APP_NAME=\"Acme\"\n");
  });

  it("appends keys the source does not already define", () => {
    const result = rewriteEnvContent("FOO=\"1\"\n", { BAR: "2" });
    expect(result).toContain("FOO=\"1\"");
    expect(result).toContain("BAR=\"2\"");
  });

  it("escapes quotes and backslashes so the value stays a single token", () => {
    const result = rewriteEnvContent("EXPO_PUBLIC_APP_NAME=\"\"\n", {
      EXPO_PUBLIC_APP_NAME: "Acme \"Pro\" \\ Co",
    });
    expect(result).toContain("EXPO_PUBLIC_APP_NAME=\"Acme \\\"Pro\\\" \\\\ Co\"");
  });
});

describe("buildEnvUpdates", () => {
  it("maps the five identity fields onto their EXPO_PUBLIC_APP_* keys", () => {
    const updates = buildEnvUpdates(deriveIdentityDefaults("Acme Corp"), "none");
    expect(updates[IDENTITY_ENV_KEYS.name]).toBe("Acme Corp");
    expect(updates[IDENTITY_ENV_KEYS.slug]).toBe("acme-corp");
    expect(updates[IDENTITY_ENV_KEYS.scheme]).toBe("acme-corp");
    expect(updates[IDENTITY_ENV_KEYS.iosBundleIdentifier]).toBe("com.acmecorp");
    expect(updates[IDENTITY_ENV_KEYS.androidPackage]).toBe("com.acmecorp");
  });

  it("writes the auth selector for a chosen provider and blanks it for none", () => {
    const identity = deriveIdentityDefaults("Acme");
    expect(buildEnvUpdates(identity, "clerk").EXPO_PUBLIC_AUTH_PROVIDER).toBe("clerk");
    expect(buildEnvUpdates(identity, "cognito").EXPO_PUBLIC_AUTH_PROVIDER).toBe("cognito");
    expect(buildEnvUpdates(identity, "none").EXPO_PUBLIC_AUTH_PROVIDER).toBe("");
  });

  it("never writes provider credentials — the unused block stays blank", () => {
    const keys = Object.keys(buildEnvUpdates(deriveIdentityDefaults("Acme"), "clerk"));
    expect(keys).not.toContain("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(keys).not.toContain("CLERK_SECRET_KEY");
    expect(keys).not.toContain("EXPO_PUBLIC_USER_POOL_ID");
    expect(keys).not.toContain("EXPO_PUBLIC_USER_POOL_CLIENT_ID");
  });
});

describe("parseAuthChoice", () => {
  it("accepts menu numbers and provider names", () => {
    expect(parseAuthChoice("1")).toBe("clerk");
    expect(parseAuthChoice("clerk")).toBe("clerk");
    expect(parseAuthChoice("2")).toBe("cognito");
    expect(parseAuthChoice("COGNITO")).toBe("cognito");
    expect(parseAuthChoice("3")).toBe("none");
    expect(parseAuthChoice("none")).toBe("none");
  });

  it("defaults an empty answer to none and rejects anything else", () => {
    expect(parseAuthChoice("")).toBe("none");
    expect(parseAuthChoice("auth0")).toBeNull();
    expect(parseAuthChoice("4")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Template pruning plan
// ---------------------------------------------------------------------------

const TEMPLATES = [
  { id: "chat", route: "/(main)/(demos)/screen-chat" },
  { id: "detail-hero", route: "/(main)/(demos)/detail-hero" },
  { id: "list", route: "/(main)/(demos)/screen-list" },
  { id: "welcome", route: "/(main)/(demos)/screen-welcome" },
];

describe("parseTemplateMeta", () => {
  it("reads id and route out of a real meta.ts shape", () => {
    const source = [
      "import type { ScreenTemplateEntry } from \"../types\";",
      "",
      "export const meta: ScreenTemplateEntry = {",
      "  id: \"detail-hero\",",
      "  route: \"/(main)/(demos)/detail-hero\",",
      "  label: \"Detail / Hero\",",
      "  order: 130,",
      "};",
    ].join("\n");
    expect(parseTemplateMeta(source)).toEqual({
      id: "detail-hero",
      route: "/(main)/(demos)/detail-hero",
    });
  });

  it("returns null when either field is missing", () => {
    expect(parseTemplateMeta("export const meta = { id: \"x\" };")).toBeNull();
    expect(parseTemplateMeta("export const meta = { route: \"/x\" };")).toBeNull();
  });
});

describe("routeFileForTemplate", () => {
  it("maps meta.route onto its app/ route file", () => {
    expect(routeFileForTemplate("/(main)/(demos)/screen-list")).toBe(
      "app/(main)/(demos)/screen-list.tsx",
    );
  });

  it("honors routes that do not follow the screen-<id> convention", () => {
    // detail-hero's route is `detail-hero`, not `screen-detail-hero`; deriving
    // the path from the id would orphan the real route file.
    expect(routeFileForTemplate("/(main)/(demos)/detail-hero")).toBe(
      "app/(main)/(demos)/detail-hero.tsx",
    );
  });
});

describe("buildPrunePlan", () => {
  it("splits kept from pruned and resolves both deletion paths", () => {
    const plan = buildPrunePlan(TEMPLATES, ["list", "welcome"]);
    expect(plan.keep.map((t) => t.id)).toEqual(["list", "welcome"]);
    expect(plan.prune).toEqual([
      {
        id: "chat",
        folder: "client/templates/chat",
        routeFile: "app/(main)/(demos)/screen-chat.tsx",
      },
      {
        id: "detail-hero",
        folder: "client/templates/detail-hero",
        routeFile: "app/(main)/(demos)/detail-hero.tsx",
      },
    ]);
  });

  it("prunes nothing when every id is kept", () => {
    const plan = buildPrunePlan(TEMPLATES, TEMPLATES.map((t) => t.id));
    expect(plan.prune).toEqual([]);
    expect(plan.keep).toHaveLength(TEMPLATES.length);
  });

  it("prunes everything when the keep list is empty", () => {
    const plan = buildPrunePlan(TEMPLATES, []);
    expect(plan.keep).toEqual([]);
    expect(plan.prune).toHaveLength(TEMPLATES.length);
  });

  it("ignores keep ids that match no template", () => {
    const plan = buildPrunePlan(TEMPLATES, ["list", "nope"]);
    expect(plan.keep.map((t) => t.id)).toEqual(["list"]);
    expect(plan.prune).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Dangling-reference guard
// ---------------------------------------------------------------------------

describe("collectTemplateReferences", () => {
  it("finds @/ alias imports out of a pruned template folder", () => {
    const files = [
      {
        path: "client/features/billing/lib/pricing.ts",
        content: "import type { X } from \"@/client/templates/pricing/Screen\";",
      },
    ];
    expect(collectTemplateReferences(files, ["pricing", "chat"])).toEqual({
      "pricing": ["client/features/billing/lib/pricing.ts"],
    });
  });

  it("finds relative-style references too", () => {
    const files = [{ path: "client/a.ts", content: "require(\"client/templates/chat/Screen\")" }];
    expect(collectTemplateReferences(files, ["chat"])).toEqual({ chat: ["client/a.ts"] });
  });

  it("ignores templates that are being kept", () => {
    const files = [
      { path: "client/a.ts", content: "import \"@/client/templates/pricing/Screen\";" },
    ];
    expect(collectTemplateReferences(files, ["chat"])).toEqual({});
  });

  it("dedupes multiple references from the same file", () => {
    const files = [
      {
        path: "client/a.ts",
        content:
          "import \"@/client/templates/chat/Screen\";\nimport \"@/client/templates/chat/demo\";",
      },
    ];
    expect(collectTemplateReferences(files, ["chat"])).toEqual({ chat: ["client/a.ts"] });
  });

  it("collects every referring file for one template", () => {
    const files = [
      { path: "client/a.ts", content: "import \"@/client/templates/chat/Screen\";" },
      { path: "client/b.ts", content: "import \"@/client/templates/chat/Screen\";" },
    ];
    expect(collectTemplateReferences(files, ["chat"]).chat).toEqual([
      "client/a.ts",
      "client/b.ts",
    ]);
  });
});

describe("resolvePrunePlan", () => {
  it("keeps a pruned template that app code still imports", () => {
    // Pruning `pricing` while client/features/billing imports a type from it
    // would leave the project failing `tsc`.
    const files = [
      {
        path: "client/features/billing/lib/pricing.ts",
        content: "import type { X } from \"@/client/templates/pricing/Screen\";",
      },
    ];
    const templates = [...TEMPLATES, { id: "pricing", route: "/(main)/(demos)/screen-pricing" }];
    const { plan, retained } = resolvePrunePlan(templates, ["list"], files);

    expect(plan.keep.map((t) => t.id)).toEqual(["list", "pricing"]);
    expect(plan.prune.map((p) => p.id)).not.toContain("pricing");
    expect(retained).toEqual({
      pricing: ["client/features/billing/lib/pricing.ts"],
    });
  });

  it("prunes freely when nothing references the removed templates", () => {
    const { plan, retained } = resolvePrunePlan(TEMPLATES, ["list"], []);
    expect(retained).toEqual({});
    expect(plan.prune.map((p) => p.id)).toEqual(["chat", "detail-hero", "welcome"]);
  });

  it("does not treat a kept template's own imports as a blocker", () => {
    const files = [
      { path: "client/a.ts", content: "import \"@/client/templates/list/Screen\";" },
    ];
    const { plan, retained } = resolvePrunePlan(TEMPLATES, ["list"], files);
    expect(retained).toEqual({});
    expect(plan.keep.map((t) => t.id)).toEqual(["list"]);
  });
});

describe("readSourceFiles", () => {
  const PROJECT_ROOT = path.join(__dirname, "..", "..");

  it("reads the app source roots and returns repo-relative posix paths", () => {
    const files = readSourceFiles(PROJECT_ROOT);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files.slice(0, 25)) {
      expect(file.path).not.toContain("\\");
      expect(file.path).toMatch(/^(app|client|server|shared)\//);
    }
  });

  it("honors the ignore list so files slated for deletion are not scanned", () => {
    const all = readSourceFiles(PROJECT_ROOT);
    const withoutTemplates = readSourceFiles(PROJECT_ROOT, ["client/templates"]);
    expect(all.some((f) => f.path.startsWith("client/templates/"))).toBe(true);
    expect(withoutTemplates.some((f) => f.path.startsWith("client/templates/"))).toBe(false);
  });

  it("surfaces the real billing → pricing template coupling", () => {
    // Regression guard: if this import ever moves, the prune guard's reason
    // for existing changes with it.
    const files = readSourceFiles(PROJECT_ROOT, ["client/templates"]);
    const references = collectTemplateReferences(files, ["pricing"]);
    expect(references.pricing).toContain("client/features/billing/lib/pricing.ts");
  });
});

describe("parseTemplateSelection", () => {
  it("keeps everything for a blank answer or \"all\"", () => {
    expect(parseTemplateSelection("", TEMPLATES).ids).toEqual([
      "chat",
      "detail-hero",
      "list",
      "welcome",
    ]);
    expect(parseTemplateSelection("all", TEMPLATES).ids).toHaveLength(4);
  });

  it("keeps nothing for \"none\"", () => {
    expect(parseTemplateSelection("none", TEMPLATES).ids).toEqual([]);
  });

  it("accepts comma- and space-separated ids", () => {
    expect(parseTemplateSelection("chat,list", TEMPLATES).ids).toEqual(["chat", "list"]);
    expect(parseTemplateSelection("chat list", TEMPLATES).ids).toEqual(["chat", "list"]);
    expect(parseTemplateSelection("chat, list", TEMPLATES).ids).toEqual(["chat", "list"]);
  });

  it("accepts 1-based menu numbers", () => {
    expect(parseTemplateSelection("1,3", TEMPLATES).ids).toEqual(["chat", "list"]);
  });

  it("dedupes overlapping id and number references", () => {
    expect(parseTemplateSelection("chat,1", TEMPLATES).ids).toEqual(["chat"]);
  });

  it("reports unknown tokens instead of dropping them silently", () => {
    const selection = parseTemplateSelection("chat,nope,99", TEMPLATES);
    expect(selection.ids).toEqual(["chat"]);
    expect(selection.unknown).toEqual(["nope", "99"]);
  });
});

// ---------------------------------------------------------------------------
// screens.test.tsx surgery
// ---------------------------------------------------------------------------

const SCREENS_TEST_FIXTURE = `import "@/test/mockTheme";

import { render, screen } from "@testing-library/react-native";

import { ErrorScreen } from "../error/Screen";
import { ListScreen } from "../list/Screen";
import { WelcomeScreen } from "../welcome/Screen";

describe("WelcomeScreen", () => {
  it("renders the title", async () => {
    await render(<WelcomeScreen title="Welcome" />);
    expect(screen.getByText("Welcome")).toBeTruthy();
  });
});

describe("ErrorScreen", () => {
  it("renders a not-found variant with a \\"quoted\\" string", async () => {
    await render(<ErrorScreen variant="not-found" />);
    expect(screen.getByText("Page not found")).toBeTruthy();
  });
});

describe("ListScreen", () => {
  it("renders items", async () => {
    await render(<ListScreen data={[{ id: "1" }]} />);
    expect(screen.getByText("1")).toBeTruthy();
  });
});
`;

describe("stripTemplateTests", () => {
  it("removes the import and describe block for a pruned template", () => {
    const result = stripTemplateTests(SCREENS_TEST_FIXTURE, ["error"]);
    expect(result.removedIds).toEqual(["error"]);
    expect(result.content).not.toContain("../error/Screen");
    expect(result.content).not.toContain("describe(\"ErrorScreen\"");
    expect(result.content).not.toContain("not-found");
    expect(result.hasTests).toBe(true);
  });

  it("keeps the surviving suites and their imports intact", () => {
    const result = stripTemplateTests(SCREENS_TEST_FIXTURE, ["error"]);
    expect(result.content).toContain("import { ListScreen } from \"../list/Screen\";");
    expect(result.content).toContain("describe(\"ListScreen\"");
    expect(result.content).toContain("import { WelcomeScreen } from \"../welcome/Screen\";");
    expect(result.content).toContain("describe(\"WelcomeScreen\"");
    expect(result.content).toContain("import \"@/test/mockTheme\";");
  });

  it("removes several templates in one pass", () => {
    const result = stripTemplateTests(SCREENS_TEST_FIXTURE, ["error", "list"]);
    expect(result.removedIds).toEqual(["error", "list"]);
    expect(result.content).not.toContain("ErrorScreen");
    expect(result.content).not.toContain("ListScreen");
    expect(result.content).toContain("WelcomeScreen");
    expect(result.hasTests).toBe(true);
  });

  it("is a no-op for templates the suite never imported", () => {
    // Only 7 of the 17 templates appear in screens.test.tsx.
    const result = stripTemplateTests(SCREENS_TEST_FIXTURE, ["chat", "dashboard"]);
    expect(result.removedIds).toEqual([]);
    expect(result.content).toBe(SCREENS_TEST_FIXTURE);
  });

  it("flags an empty suite so the caller can delete the file", () => {
    const result = stripTemplateTests(SCREENS_TEST_FIXTURE, ["error", "list", "welcome"]);
    expect(result.removedIds).toEqual(["error", "list", "welcome"]);
    expect(result.hasTests).toBe(false);
  });

  it("collapses the blank lines left behind by a removal", () => {
    const result = stripTemplateTests(SCREENS_TEST_FIXTURE, ["error"]);
    expect(result.content).not.toMatch(/\n{3,}/);
  });
});

const REAL_SCREENS_TEST = path.join(
  __dirname,
  "..",
  "..",
  "client",
  "templates",
  "__tests__",
  "screens.test.tsx",
);
const withRealSuite = fs.existsSync(REAL_SCREENS_TEST) ? describe : describe.skip;

withRealSuite("stripTemplateTests — against the checked-in screens.test.tsx", () => {
  const source = fs.existsSync(REAL_SCREENS_TEST)
    ? fs.readFileSync(REAL_SCREENS_TEST, "utf8")
    : "";
  const importedIds = [...source.matchAll(/from "\.\.\/([a-z0-9-]+)\/Screen";/g)].map(
    (match) => match[1],
  );

  it("finds the template imports it will have to rewrite", () => {
    expect(importedIds.length).toBeGreaterThan(0);
  });

  it("removes every import and leaves no orphaned describe block", () => {
    const result = stripTemplateTests(source, importedIds);
    expect(result.removedIds.sort()).toEqual([...importedIds].sort());
    expect(result.content).not.toMatch(/from "\.\.\/[a-z0-9-]+\/Screen";/);
    expect(result.content).not.toMatch(/^describe\(/m);
    expect(result.hasTests).toBe(false);
  });

  it("keeps the file valid when only one template is pruned", () => {
    const [first, ...rest] = importedIds;
    const result = stripTemplateTests(source, [first]);
    expect(result.content).not.toContain(`../${first}/Screen`);
    for (const id of rest) {
      expect(result.content).toContain(`../${id}/Screen`);
    }
    expect(result.hasTests).toBe(rest.length > 0);
  });
});

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("parses the documented non-interactive invocation", () => {
    const options = parseArgs([
      "--name",
      "Acme Corp",
      "--slug",
      "acme",
      "--scheme",
      "acme",
      "--bundle-id",
      "com.acme.app",
      "--android-package",
      "com.acme.app",
      "--auth",
      "clerk",
      "--templates",
      "chat,list",
      "--yes",
    ]);

    expect(options).toMatchObject({
      name: "Acme Corp",
      slug: "acme",
      scheme: "acme",
      iosBundleIdentifier: "com.acme.app",
      androidPackage: "com.acme.app",
      auth: "clerk",
      templates: "chat,list",
      yes: true,
    });
    expect(options.unknownFlags).toEqual([]);
  });

  it("accepts --flag=value form", () => {
    const options = parseArgs(["--name=Acme", "--templates=none"]);
    expect(options.name).toBe("Acme");
    expect(options.templates).toBe("none");
  });

  it("tracks --force, -y, and the prebuild tri-state", () => {
    expect(parseArgs(["--force"]).force).toBe(true);
    expect(parseArgs(["-y"]).yes).toBe(true);
    expect(parseArgs([]).prebuild).toBeUndefined();
    expect(parseArgs(["--prebuild"]).prebuild).toBe(true);
    expect(parseArgs(["--no-prebuild"]).prebuild).toBe(false);
  });

  it("distinguishes an omitted --templates from an empty one", () => {
    // Omitted means "don't prune"; `--templates none` means "prune all".
    expect(parseArgs(["--name", "Acme"]).templates).toBeUndefined();
    expect(parseArgs(["--templates", "none"]).templates).toBe("none");
  });

  it("collects unknown flags instead of ignoring them", () => {
    expect(parseArgs(["--nope", "--name", "Acme"]).unknownFlags).toEqual(["--nope"]);
  });
});

describe("resolveIdentityFromOptions", () => {
  it("derives everything the flags omitted", () => {
    const identity = resolveIdentityFromOptions(parseArgs(["--name", "Acme Corp", "--yes"]));
    expect(identity).toEqual({
      name: "Acme Corp",
      slug: "acme-corp",
      scheme: "acme-corp",
      iosBundleIdentifier: "com.acmecorp",
      androidPackage: "com.acmecorp",
    });
  });

  it("prefers explicit flags over derived defaults", () => {
    const identity = resolveIdentityFromOptions(
      parseArgs(["--name", "Acme Corp", "--slug", "acme", "--bundle-id", "io.acme.mobile"]),
    );
    expect(identity.slug).toBe("acme");
    expect(identity.scheme).toBe("acme-corp");
    expect(identity.iosBundleIdentifier).toBe("io.acme.mobile");
    expect(identity.androidPackage).toBe("com.acmecorp");
  });

  it("leaves a missing --name invalid so the CLI fails instead of writing defaults", () => {
    const identity = resolveIdentityFromOptions(parseArgs(["--yes"]));
    expect(validateIdentity(identity).length).toBeGreaterThan(0);
  });
});
