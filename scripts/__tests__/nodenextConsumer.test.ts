/**
 * NodeNext consumer fixture for the published packages.
 *
 * A consumer on `module`/`moduleResolution: nodenext` resolves the built
 * declarations the way Node resolves JavaScript: `./foo` is not `./foo.d.ts`
 * and `./dir` is not `./dir/index.d.ts`. Every such import in a `.d.ts` fails
 * to resolve, `skipLibCheck` (on in nearly every app) hides the error, and each
 * symbol behind it silently becomes `any` — `createMediaHandlers` typed as `any`
 * compiles, and so does every wrong call to it.
 *
 * This builds `@mrmeg/expo-ui`, `@mrmeg/expo-media` and `@mrmeg/expo-purchases`
 * the way their `build` scripts do (`tsc -p tsconfig.build.json`, then
 * `scripts/fix-package-esm.mjs`), installs each under a throwaway project's
 * `node_modules` with its real `package.json`, and type-checks an ESM entry that
 * imports every public entry point — each `exports` key, with the `*` patterns
 * expanded to the modules they expose. It fails on:
 *
 * - an entry point the fixture cannot import,
 * - any module specifier in a built declaration that does not resolve,
 * - any export of an entry point whose type is `any`.
 *
 * The fixture sets no `customConditions`, so it is also the proof that the
 * repo-only `@mrmeg/source` export condition is inert for consumers: its `src`
 * targets are not installed here, and nothing may resolve through them.
 */
import { execFileSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join, relative, sep } from "path";
import ts from "typescript";

const root = join(__dirname, "..", "..");
const tscBin = join(root, "node_modules", "typescript", "bin", "tsc");

const PACKAGES = [
  { key: "ui", dir: "packages/ui" },
  { key: "media", dir: "packages/media" },
  { key: "purchases", dir: "packages/purchases" },
] as const;

/** The repo-only condition that points at `src`; a consumer never sets it. */
const SOURCE_CONDITION = "@mrmeg/source";

type ExportTarget = string | { [condition: string]: ExportTarget } | null;

interface Manifest {
  name: string;
  exports: Record<string, ExportTarget>;
}

interface EntryPoint {
  specifier: string;
  packageName: string;
}

jest.setTimeout(15 * 60 * 1000);

let workspace: string;
let fixtureRoot: string;
let program: ts.Program;
let entryPoints: EntryPoint[];
const compilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
};

/** The declaration target a consumer's TypeScript picks for one export entry. */
function typesTarget(target: ExportTarget): string | null {
  if (typeof target === "string") return target.endsWith(".d.ts") ? target : null;
  if (!target) return null;
  for (const [condition, value] of Object.entries(target)) {
    if (condition === SOURCE_CONDITION) continue;
    if (condition === "types") return typeof value === "string" ? value : typesTarget(value);
  }
  return null;
}

/** Every importable specifier of one installed package: exact keys plus expanded patterns. */
function entryPointsOf(manifest: Manifest, installedDir: string): string[] {
  const specifiers = new Set<string>();
  for (const [key, target] of Object.entries(manifest.exports)) {
    const types = typesTarget(target);
    if (!types) continue; // assets such as `./design-system.json`
    if (!key.includes("*")) {
      specifiers.add(key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`);
      continue;
    }
    const [before, after] = types.split("*");
    const directory = join(installedDir, before);
    for (const file of readdirSync(directory)) {
      if (!file.endsWith(after)) continue;
      const name = file.slice(0, -after.length);
      // Platform variants are reached through their base module, never directly.
      if (/\.(native|web|ios|android)$/.test(name)) continue;
      specifiers.add(`${manifest.name}/${key.slice(2).replace("*", name)}`);
    }
  }
  return [...specifiers].sort();
}

function isPackageDeclaration(fileName: string): boolean {
  return fileName.startsWith(join(fixtureRoot, "node_modules", "@mrmeg") + sep) && fileName.endsWith(".d.ts");
}

function moduleSpecifiersOf(sourceFile: ts.SourceFile): ts.StringLiteralLike[] {
  const found: ts.StringLiteralLike[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      found.push(node.argument.literal);
    } else if (ts.isModuleDeclaration(node) && ts.isStringLiteralLike(node.name)) {
      // `declare module "x"` augmentations name a module; they do not import one.
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * Dependencies whose own ESM declarations do not resolve under `nodenext`.
 * `@rn-primitives/*` ships `index.d.mts` with `export * from './dialog'`, so its
 * members are `any` to a NodeNext consumer of *any* package that re-exports them.
 * That is theirs to fix; an export typed `typeof DialogPrimitive.Trigger` in our
 * declarations is correct and inherits the `any`.
 */
const UNTYPED_UNDER_NODENEXT = [/^@rn-primitives\//];

const EXPECTED_INHERITED_ANY = [
  "AlertDialogAction (@rn-primitives/alert-dialog)",
  "AlertDialogCancel (@rn-primitives/alert-dialog)",
  "AlertDialogTrigger (@rn-primitives/alert-dialog)",
  "DialogClose (@rn-primitives/dialog)",
  "DialogTrigger (@rn-primitives/dialog)",
  "DropdownMenu (@rn-primitives/dropdown-menu)",
  "DropdownMenuGroup (@rn-primitives/dropdown-menu)",
  "DropdownMenuPortal (@rn-primitives/dropdown-menu)",
  "DropdownMenuRadioGroup (@rn-primitives/dropdown-menu)",
  "DropdownMenuSub (@rn-primitives/dropdown-menu)",
  "Popover (@rn-primitives/popover)",
  "Select (@rn-primitives/select)",
  "TooltipTrigger (@rn-primitives/tooltip)",
];

/**
 * The external module an `any` export takes its type from: the bare-specifier
 * import at the root of a `typeof Imported.Member` / `Imported.Member` in its
 * declared type, followed through the local aliases and variables in between
 * (`Popover: PopoverComponent`, `type PopoverComponent = typeof PopoverRoot & …`,
 * `PopoverRoot: typeof PopoverPrimitive.Root`).
 */
function inheritedFrom(checker: ts.TypeChecker, symbol: ts.Symbol): string | null {
  const seen = new Set<ts.Node>();

  const fromEntity = (name: ts.EntityName, depth: number): string | null => {
    let entity = name;
    while (ts.isQualifiedName(entity)) entity = entity.left;
    const declaration = checker.getSymbolAtLocation(entity)?.declarations?.[0];
    if (!declaration) return null;
    let node: ts.Node | undefined = declaration;
    while (node && !ts.isImportDeclaration(node) && !ts.isSourceFile(node)) node = node.parent;
    if (node && ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      return specifier.startsWith(".") || specifier.startsWith("@mrmeg/") ? null : specifier;
    }
    return fromDeclaration(declaration, depth + 1);
  };

  const fromType = (type: ts.TypeNode, depth: number): string | null => {
    let found: string | null = null;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (ts.isTypeQueryNode(node)) found = fromEntity(node.exprName, depth);
      else if (ts.isTypeReferenceNode(node)) found = fromEntity(node.typeName, depth);
      if (!found) ts.forEachChild(node, visit);
    };
    visit(type);
    return found;
  };

  const fromDeclaration = (declaration: ts.Declaration, depth: number): string | null => {
    if (depth > 6 || seen.has(declaration)) return null;
    seen.add(declaration);
    if (ts.isVariableDeclaration(declaration) && declaration.type) return fromType(declaration.type, depth);
    if (ts.isTypeAliasDeclaration(declaration)) return fromType(declaration.type, depth);
    return null;
  };

  const declaration = symbol.declarations?.[0];
  return declaration ? fromDeclaration(declaration, 0) : null;
}

beforeAll(() => {
  // The installed packages import react-native, @tanstack/react-query, zustand,
  // … from their declarations. A `node_modules` link one level above the fixture
  // lets those resolve against the workspace install, the way they would against
  // a consumer's, while the fixture's own `node_modules/@mrmeg/*` shadows the
  // workspace packages.
  // Real path: TypeScript reports source files by it, and macOS's tmpdir is a link.
  workspace = realpathSync(mkdtempSync(join(tmpdir(), "nodenext-consumer-")));
  symlinkSync(join(root, "node_modules"), join(workspace, "node_modules"), "dir");
  fixtureRoot = join(workspace, "fixture");

  entryPoints = [];
  for (const pkg of PACKAGES) {
    const manifest = JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")) as Manifest;
    const installedDir = join(fixtureRoot, "node_modules", ...manifest.name.split("/"));
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, "package.json"), JSON.stringify(manifest, null, 2));

    const dist = join(installedDir, "dist");
    execFileSync("node", [tscBin, "-p", join(pkg.dir, "tsconfig.build.json"), "--outDir", dist], {
      cwd: root,
      stdio: "pipe",
    });
    execFileSync("node", ["scripts/fix-package-esm.mjs", pkg.key, "--dist", dist], {
      cwd: root,
      stdio: "pipe",
    });

    for (const specifier of entryPointsOf(manifest, installedDir)) {
      entryPoints.push({ specifier, packageName: manifest.name });
    }
  }

  writeFileSync(
    join(fixtureRoot, "package.json"),
    JSON.stringify({ name: "nodenext-consumer", private: true, type: "module" }, null, 2),
  );
  const entry = entryPoints
    .map(({ specifier }, index) => `import * as entry${index} from ${JSON.stringify(specifier)};`)
    .concat([
      "",
      `export const entries = [${entryPoints.map((_, index) => `entry${index}`).join(", ")}];`,
      "",
    ])
    .join("\n");
  writeFileSync(join(fixtureRoot, "index.ts"), entry);

  program = ts.createProgram({ rootNames: [join(fixtureRoot, "index.ts")], options: compilerOptions });
});

afterAll(() => {
  if (workspace && existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
});

function format(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => fixtureRoot,
    getNewLine: () => "\n",
  });
}

describe("NodeNext consumer of the built packages", () => {
  it("covers every package's public entry points", () => {
    const byPackage = new Map<string, number>();
    for (const { packageName } of entryPoints) {
      byPackage.set(packageName, (byPackage.get(packageName) ?? 0) + 1);
    }
    expect([...byPackage.keys()].sort()).toEqual([
      "@mrmeg/expo-media",
      "@mrmeg/expo-purchases",
      "@mrmeg/expo-ui",
    ]);
    // The `components/*` pattern expands to the individual modules consumers
    // deep-import, not just the barrel.
    const specifiers = entryPoints.map(({ specifier }) => specifier);
    expect(specifiers).toEqual(
      expect.arrayContaining([
        "@mrmeg/expo-ui/components/Button",
        "@mrmeg/expo-ui/components/iconRegistry.generated",
        "@mrmeg/expo-media/processing/image-compression/config",
        "@mrmeg/expo-media/server",
        "@mrmeg/expo-purchases/server",
      ]),
    );
  });

  it("imports every entry point without an error", () => {
    const entryFile = program.getSourceFile(join(fixtureRoot, "index.ts"));
    expect(entryFile).toBeDefined();
    const diagnostics = [
      ...program.getSyntacticDiagnostics(entryFile),
      ...program.getSemanticDiagnostics(entryFile),
    ];
    expect(format(diagnostics)).toBe("");
  });

  it("resolves every module specifier in the built declarations", () => {
    const unresolved: string[] = [];
    let checked = 0;
    for (const sourceFile of program.getSourceFiles()) {
      if (!isPackageDeclaration(sourceFile.fileName)) continue;
      for (const specifier of moduleSpecifiersOf(sourceFile)) {
        checked += 1;
        const { resolvedModule } = ts.resolveModuleName(
          specifier.text,
          sourceFile.fileName,
          compilerOptions,
          ts.sys,
          undefined,
          undefined,
          program.getModeForUsageLocation(sourceFile, specifier),
        );
        if (!resolvedModule) {
          unresolved.push(`${relative(fixtureRoot, sourceFile.fileName)}: ${JSON.stringify(specifier.text)}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(unresolved).toEqual([]);
  });

  it("types no export of any entry point as `any`", () => {
    const checker = program.getTypeChecker();
    const entryFile = program.getSourceFile(join(fixtureRoot, "index.ts"))!;
    const anyExports: string[] = [];
    const inherited = new Set<string>();
    let checked = 0;

    for (const statement of entryFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
      if (!moduleSymbol) {
        anyExports.push(`${statement.moduleSpecifier.text}: module did not resolve`);
        continue;
      }
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const target =
          exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const type =
          target.flags & ts.SymbolFlags.Value
            ? checker.getTypeOfSymbolAtLocation(target, statement)
            : checker.getDeclaredTypeOfSymbol(target);
        checked += 1;
        if (!(type.flags & ts.TypeFlags.Any)) continue;
        const origin = inheritedFrom(checker, target);
        if (origin && UNTYPED_UNDER_NODENEXT.some((pattern) => pattern.test(origin))) {
          inherited.add(`${exported.getName()} (${origin})`);
          continue;
        }
        anyExports.push(`${statement.moduleSpecifier.text}: ${exported.getName()}`);
      }
    }

    expect(checked).toBeGreaterThan(200);
    expect(anyExports).toEqual([]);
    // Pinned so a dependency that starts (or stops) degrading is noticed.
    expect([...inherited].sort()).toEqual(EXPECTED_INHERITED_ANY);
  });
});
