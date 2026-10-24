/**
 * The barrel stays peer-free.
 *
 * `expo-image`, `expo-video` and `expo-audio` are optional peers of
 * `@mrmeg/expo-ui`, and seven consumer apps import the barrel. If any module
 * reachable from `src/index.ts` imports one of them, every consumer must
 * install it. Media components are subpath-only
 * (`@mrmeg/expo-ui/components/Video`, ...), so nothing under the barrel may
 * pull them in, directly or through a re-export chain.
 *
 * The walk starts at `src/index.ts` and follows every relative import, with
 * the TypeScript parser as `packageSideEffects.test.ts` does:
 * `import` / `export ... from`, dynamic `import()`, `require()`,
 * `import x = require()` and `import("x").T` types. `import type` counts too:
 * the emitted `.d.ts` would still name the module. Platform variants
 * (`X.native.ts`, `X.ios.tsx`, `X.android.tsx`, `X.web.tsx`) are all followed,
 * since each platform's bundle resolves one of them.
 */
import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";

const srcRoot = path.join(__dirname, "..");

/** Package names (and their subpaths) that must not be reachable from the barrel. */
const MEDIA_PEERS = ["expo-image", "expo-video", "expo-audio"];
const isMediaPeer = (specifier: string) =>
  MEDIA_PEERS.some((name) => specifier === name || specifier.startsWith(`${name}/`));

const EXTENSIONS = [".ts", ".tsx"];
const PLATFORM_SUFFIXES = ["", ".native", ".ios", ".android", ".web"];

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Every module specifier a file names, whatever the syntax. */
function specifiersOf(file: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      found.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require")) {
        found.push(node.arguments[0].text);
      }
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      found.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return found;
}

/** Every file a relative specifier can resolve to: the file itself, each platform variant, or a directory index. */
function resolveRelative(fromFile: string, specifier: string): string[] {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = new Set<string>();
  if (fs.existsSync(base) && fs.statSync(base).isFile()) candidates.add(base);
  for (const suffix of PLATFORM_SUFFIXES) {
    for (const extension of EXTENSIONS) {
      candidates.add(`${base}${suffix}${extension}`);
      candidates.add(path.join(base, `index${suffix}${extension}`));
    }
  }
  return [...candidates].filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

interface Walk {
  visited: Set<string>;
  /** `file -> specifier` for each media-peer import reached. */
  offenders: string[];
  /** Relative specifiers that resolved to no source file. */
  unresolved: string[];
}

function walk(entry: string, root: string): Walk {
  const visited = new Set<string>();
  const offenders: string[] = [];
  const unresolved: string[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (visited.has(file)) continue;
    visited.add(file);

    for (const specifier of specifiersOf(file)) {
      if (isMediaPeer(specifier)) {
        offenders.push(`${path.relative(root, file)} -> ${specifier}`);
      } else if (specifier.startsWith(".")) {
        const resolved = resolveRelative(file, specifier);
        if (resolved.length === 0) unresolved.push(`${path.relative(root, file)} -> ${specifier}`);
        queue.push(...resolved);
      }
    }
  }
  return { visited, offenders, unresolved };
}

describe("the barrel does not import the optional media peers", () => {
  const result = walk(path.join(srcRoot, "index.ts"), srcRoot);
  const visitedRelative = new Set([...result.visited].map((file) => path.relative(srcRoot, file).split(path.sep).join("/")));

  it("reaches no module that imports expo-image, expo-video or expo-audio", () => {
    expect(result.offenders).toEqual([]);
  });

  it("walked the real graph (a resolver bug must not pass silently)", () => {
    // Through the components barrel, a lib barrel, a hook, and platform variants.
    expect([...visitedRelative]).toEqual(
      expect.arrayContaining([
        "index.ts",
        "components/index.ts",
        "components/Button.tsx",
        "components/IconButton.tsx",
        "lib/index.ts",
        "lib/mediaFrame.ts",
        "lib/mediaTime.ts",
        "hooks/index.ts",
        "hooks/useMediaKeyboard.ts",
        "components/keyboardController.native.ts",
      ]),
    );
    expect(result.visited.size).toBeGreaterThan(100);
  });

  it("resolved every relative import, but JSON data", () => {
    expect(result.unresolved.filter((entry) => !entry.endsWith(".json"))).toEqual([]);
  });

  it("keeps the subpath-only media components out of the graph", () => {
    for (const subpathOnly of [
      "components/Image.tsx",
      "components/MediaControlButton.tsx",
      "components/MediaScrubber.tsx",
      "components/MediaViewer.tsx",
      "components/Video.tsx",
      "components/videoPlayback.tsx",
      "lib/mediaZoom.ts",
      "lib/webFullscreen.ts",
      "lib/webZoomEvents.ts",
    ]) {
      expect(visitedRelative.has(subpathOnly)).toBe(false);
    }
  });
});

describe("the walker (self-check)", () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "media-peers-"));
    const write = (name: string, body: string) => {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), body);
    };
    write("index.ts", `export * from "./components";\nexport * from "./clean";\n`);
    write("clean.ts", `export const clean = 1;\n`);
    write("components/index.ts", `export * from "./Video";\nexport { Lazy } from "./Lazy";\nexport type { T } from "./types";\nexport * from "./dyn";\nexport * from "./req";\n`);
    // A platform variant only: `./Video` resolves to `Video.ios.tsx` for the iOS bundle.
    write("components/Video.ios.tsx", `import { VideoView } from "expo-video/build/VideoView";\nexport const Video = VideoView;\n`);
    write("components/Lazy.tsx", `import type { Image } from "expo-image";\nexport type Lazy = Image;\n`);
    write("components/types.ts", `export type T = import("expo-audio").AudioPlayer;\n`);
    write("components/dyn.ts", `export const load = () => import("expo-video");\n`);
    write("components/req.ts", `export const audio = require("expo-audio");\n`);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("finds a media import through a re-export chain, a platform variant, import type, import() types, import() and require()", () => {
    const { offenders, visited, unresolved } = walk(path.join(dir, "index.ts"), dir);

    expect(unresolved).toEqual([]);
    expect(visited.size).toBe(8);
    expect(offenders.sort()).toEqual(
      [
        "components/Video.ios.tsx -> expo-video/build/VideoView",
        "components/Lazy.tsx -> expo-image",
        "components/types.ts -> expo-audio",
        "components/dyn.ts -> expo-video",
        "components/req.ts -> expo-audio",
      ].sort(),
    );
  });

  it("does not flag a package that merely starts with a media peer's name", () => {
    expect(isMediaPeer("expo-video")).toBe(true);
    expect(isMediaPeer("expo-video/build/x")).toBe(true);
    expect(isMediaPeer("expo-video-thumbnails")).toBe(false);
    expect(isMediaPeer("expo-image-manipulator")).toBe(false);
    expect(isMediaPeer("expo-audio-extras")).toBe(false);
  });
});
