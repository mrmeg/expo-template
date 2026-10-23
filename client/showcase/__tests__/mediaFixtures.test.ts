/**
 * Media fixture manifest contract.
 *
 * The manifest (`mediaFixtures.ts`) and the generator
 * (`scripts/build-media-fixtures.mjs`) each name every fixture, so these tests
 * hold them in step in both directions: a fixture the manifest points at must
 * be one the generator builds, and a fixture the generator builds must be
 * listed in the lab. The generator is read through `--list --json`, which needs
 * none of its tools (CI has no ffmpeg) and writes nothing.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Platform } from "react-native";

let mockExpoConfig: { hostUri?: string } | null = { hostUri: "192.168.4.28:8081" };
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

import {
  FIXTURE_CATEGORIES,
  FIXTURE_KINDS,
  FIXTURE_SURFACES,
  FIXTURE_TIERS,
  GENERATED_URL_PREFIX,
  MEDIA_FIXTURES,
  OBSERVED_VALUES,
  resolveFixtureUri,
  type MediaFixture,
} from "../mediaFixtures";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const GENERATED_DIR = "public/media-fixtures";

interface GeneratorFixture {
  id: string;
  kind: string;
  tier: "core" | "generated";
  out: string;
  tools: string[];
}

const GENERATOR: GeneratorFixture[] = JSON.parse(
  execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "build-media-fixtures.mjs"), "--list", "--json"],
    { encoding: "utf8", cwd: REPO_ROOT },
  ),
);

const generatorById = new Map(GENERATOR.map((fixture) => [fixture.id, fixture]));
const manifestById = new Map(MEDIA_FIXTURES.map((fixture) => [fixture.id, fixture]));

describe("media fixtures: manifest", () => {
  it("has unique ids", () => {
    const ids = MEDIA_FIXTURES.map((fixture) => fixture.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it("uses only known kinds, tiers and categories", () => {
    for (const fixture of MEDIA_FIXTURES) {
      expect(FIXTURE_KINDS).toContain(fixture.kind);
      expect(FIXTURE_TIERS).toContain(fixture.tier);
      expect(FIXTURE_CATEGORIES).toContain(fixture.category);
    }
  });

  it("has a non-empty label for every fixture", () => {
    expect(MEDIA_FIXTURES.filter((fixture) => !fixture.label.trim()).map((fixture) => fixture.id)).toEqual([]);
  });

  it("records `observed` only with valid surfaces and values", () => {
    for (const fixture of MEDIA_FIXTURES) {
      for (const [surface, value] of Object.entries(fixture.observed)) {
        expect(FIXTURE_SURFACES).toContain(surface);
        expect(OBSERVED_VALUES).toContain(value);
      }
    }
  });

  it("lists remote streams over HTTPS only", () => {
    const remote = MEDIA_FIXTURES.filter((fixture) => fixture.tier === "remote");
    expect(remote.length).toBeGreaterThan(0);
    for (const fixture of remote) {
      expect(typeof fixture.source).toBe("string");
      expect(fixture.source as string).toMatch(/^https:\/\/[^/]/);
    }
  });

  it("only flags broken fixtures as expecting an error", () => {
    const flagged = MEDIA_FIXTURES.filter((fixture) => fixture.expectError);
    expect(flagged.length).toBeGreaterThan(0);
    for (const fixture of flagged) {
      expect(["broken", "source"]).toContain(fixture.category);
    }
  });

  it("covers every media kind with at least one fixture per tier it uses", () => {
    for (const kind of FIXTURE_KINDS) {
      expect(MEDIA_FIXTURES.some((fixture) => fixture.kind === kind)).toBe(true);
    }
  });
});

describe("media fixtures: core tier", () => {
  const manifestSource = fs.readFileSync(path.join(REPO_ROOT, "client", "showcase", "mediaFixtures.ts"), "utf8");
  const requiredFiles = [...manifestSource.matchAll(/require\("@\/assets\/media\/([^"]+)"\)/g)].map((match) => match[1]);
  // Dotfiles are never fixtures: a Finder `.DS_Store`, or a `.partial` file an
  // interrupted generator run left behind.
  const coreFiles = fs
    .readdirSync(path.join(REPO_ROOT, "assets", "media"))
    .filter((file) => !file.startsWith("."))
    .sort();

  it("resolves every bundled require to a file in assets/media", () => {
    expect(requiredFiles.length).toBeGreaterThan(0);
    for (const file of requiredFiles) {
      expect(fs.existsSync(path.join(REPO_ROOT, "assets", "media", file))).toBe(true);
    }
  });

  it("requires every file in assets/media and nothing else", () => {
    expect([...requiredFiles].sort()).toEqual(coreFiles);
  });

  // Metro resolves `require()` of an asset to a number; Jest's asset transform
  // gives a number or a `{ testUri }` object depending on the extension. Either
  // way a bundled source is whatever is not a string.
  const isBundled = (fixture: MediaFixture) => fixture.tier === "core" && typeof fixture.source !== "string";

  it("gives every bundled core fixture a require()d source, not a path", () => {
    expect(MEDIA_FIXTURES.filter(isBundled)).toHaveLength(requiredFiles.length);
  });

  it("is the generator's core tier, id for id", () => {
    const generatorCore = GENERATOR.filter((fixture) => fixture.tier === "core").map((fixture) => fixture.id);
    const bundledIds = MEDIA_FIXTURES.filter(isBundled).map((fixture) => fixture.id);
    expect(bundledIds.sort()).toEqual([...generatorCore].sort());
  });

  it("maps each bundled core fixture to the file the generator writes", () => {
    for (const generated of GENERATOR.filter((fixture) => fixture.tier === "core")) {
      expect(generated.out).toMatch(/^assets\/media\/[^/]+$/);
      expect(requiredFiles).toContain(path.basename(generated.out));
      expect(manifestById.get(generated.id)?.kind).toBe(generated.kind);
    }
  });

  it("keeps the committed core within the 2.5 MB budget", () => {
    const total = coreFiles.reduce((sum, file) => sum + fs.statSync(path.join(REPO_ROOT, "assets", "media", file)).size, 0);
    expect(total).toBeLessThanOrEqual(2_500_000);
  });
});

describe("media fixtures: generated tier matches the generator", () => {
  const generated = MEDIA_FIXTURES.filter((fixture) => fixture.tier === "generated");
  const declared = generated.filter((fixture) => !fixture.intentionallyMissing);

  it("serves every generated path from the /media-fixtures/ prefix", () => {
    for (const fixture of generated) {
      expect(typeof fixture.source).toBe("string");
      expect(fixture.source as string).toMatch(/^\/media-fixtures\/(images|video|audio)\/[^/]+$/);
    }
  });

  it("declares every generated fixture in the generator, with the same path and kind", () => {
    for (const fixture of declared) {
      const entry = generatorById.get(fixture.id);
      expect(entry).toBeDefined();
      expect(entry?.tier).toBe("generated");
      expect(entry?.kind).toBe(fixture.kind);
      expect(entry?.out).toBe(`${GENERATED_DIR}/${(fixture.source as string).slice(GENERATED_URL_PREFIX.length)}`);
    }
  });

  it("lists every fixture the generator builds in the manifest", () => {
    const missing = GENERATOR.filter((entry) => entry.tier === "generated" && !manifestById.has(entry.id)).map((entry) => entry.id);
    expect(missing).toEqual([]);
  });

  it("keeps the generator's output inside public/media-fixtures or assets/media", () => {
    for (const entry of GENERATOR) {
      expect(entry.out).toMatch(entry.tier === "core" ? /^assets\/media\// : /^public\/media-fixtures\/(images|video|audio)\//);
    }
  });

  it("marks intentionally missing paths as absent from the generator", () => {
    const missing = generated.filter((fixture) => fixture.intentionallyMissing);
    expect(missing.length).toBeGreaterThan(0);
    for (const fixture of missing) {
      expect(fixture.expectError).toBe(true);
      expect(generatorById.has(fixture.id)).toBe(false);
      expect(GENERATOR.some((entry) => entry.out.endsWith((fixture.source as string).slice(GENERATED_URL_PREFIX.length)))).toBe(false);
    }
  });

  it("has unique generator ids and output paths", () => {
    const ids = GENERATOR.map((entry) => entry.id);
    const outs = GENERATOR.map((entry) => entry.out);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(outs).size).toBe(outs.length);
  });

  it("builds the 60-thumbnail list-scale set", () => {
    expect(declared.filter((fixture) => fixture.category === "scale")).toHaveLength(60);
  });
});

describe("resolveFixtureUri", () => {
  type OS = "web" | "ios" | "android";
  const originalPlatform = Platform.OS as OS;
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const globalWithDev = globalThis as unknown as { __DEV__: boolean };
  const originalDev = globalWithDev.__DEV__;

  const generatedFixture = manifestById.get("img-aspect-4x3") as MediaFixture;
  const coreFixture = manifestById.get("core-landscape") as MediaFixture;
  const remoteFixture = MEDIA_FIXTURES.find((fixture) => fixture.tier === "remote") as MediaFixture;
  const dataUriFixture = manifestById.get("src-data-uri") as MediaFixture;

  const setPlatform = (os: OS) => Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  const setApiUrl = (value: string | undefined) => {
    if (value === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = value;
  };

  beforeEach(() => {
    mockExpoConfig = { hostUri: "192.168.4.28:8081" };
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    setApiUrl(originalApiUrl);
    globalWithDev.__DEV__ = originalDev;
  });

  it("keeps generated paths relative on web, even when an origin is configured", () => {
    setPlatform("web");
    setApiUrl("https://app.example.dev");

    expect(resolveFixtureUri(generatedFixture)).toBe(generatedFixture.source);
  });

  it("resolves generated paths against the configured origin on native", () => {
    setPlatform("ios");
    setApiUrl("https://app.example.dev/api");

    expect(resolveFixtureUri(generatedFixture)).toBe(`https://app.example.dev${generatedFixture.source}`);
  });

  it("resolves generated paths against the dev server on native in development", () => {
    setPlatform("android");
    setApiUrl(undefined);
    globalWithDev.__DEV__ = true;

    expect(resolveFixtureUri(generatedFixture)).toBe(`http://192.168.4.28:8081${generatedFixture.source}`);
  });

  it("falls back to localhost:8081 when the dev server host is unknown", () => {
    setPlatform("ios");
    setApiUrl(undefined);
    globalWithDev.__DEV__ = true;
    mockExpoConfig = null;

    expect(resolveFixtureUri(generatedFixture)).toBe(`http://localhost:8081${generatedFixture.source}`);
  });

  it("returns null for generated paths on a native release build with no origin", () => {
    setPlatform("ios");
    setApiUrl(undefined);
    globalWithDev.__DEV__ = false;

    expect(resolveFixtureUri(generatedFixture)).toBeNull();
  });

  it("passes core, data-URI and remote sources through on every surface", () => {
    for (const os of ["web", "ios"] as const) {
      setPlatform(os);
      setApiUrl(undefined);
      globalWithDev.__DEV__ = false;

      expect(resolveFixtureUri(coreFixture)).toBe(coreFixture.source);
      expect(resolveFixtureUri(dataUriFixture)).toBe(dataUriFixture.source);
      expect(resolveFixtureUri(remoteFixture)).toBe(remoteFixture.source);
    }
  });
});
