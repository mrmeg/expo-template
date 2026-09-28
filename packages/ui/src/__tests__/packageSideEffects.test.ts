/**
 * `sideEffects` in packages/ui/package.json.
 *
 * Bundlers drop a module none of whose exports are used only when the package
 * says that is safe, so the field must list exactly the modules that do
 * something at import time, as both the `src` path (this repo reads source)
 * and the `dist` path (consumers get the build). Today that is only
 * `state/themeStore.ts`, whose native branch loads the persisted preference
 * and starts the OS color-scheme listener at module load.
 *
 * The scan below is syntactic: any top-level statement other than an import
 * with bindings, an export, or a declaration runs at import time. Module-scope
 * `StyleSheet.create` / `createThemedStyles` calls only register styles for
 * their own module, so they are allowed, and must carry `/*#__PURE__*\/` so a
 * minifier can drop them with an unused module.
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const packageRoot = path.join(__dirname, "..", "..");
const srcRoot = path.join(packageRoot, "src");
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
  });
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

const DECLARATIONS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.ImportEqualsDeclaration,
  ts.SyntaxKind.EmptyStatement,
]);

/** Top-level statements that run code at import time. */
function importTimeEffects(sf: ts.SourceFile): string[] {
  const effects: string[] = [];
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause) effects.push(`bare import ${statement.moduleSpecifier.getText(sf)}`);
      continue;
    }
    if (!DECLARATIONS.has(statement.kind)) {
      effects.push(statement.getText(sf).split("\n")[0]);
    }
  }
  return effects;
}

/** `x.dist` path tsc emits for a `src` file. */
function distPathFor(relativeSrc: string): string {
  return relativeSrc.replace(/^src\//, "dist/").replace(/\.tsx?$/, ".js");
}

describe("packages/ui sideEffects", () => {
  const files = sourceFiles(srcRoot);
  const withEffects = files
    .filter((file) => importTimeEffects(parse(file)).length > 0)
    .map((file) => path.relative(packageRoot, file).split(path.sep).join("/"))
    .sort();

  it("finds the modules with import-time side effects", () => {
    expect(withEffects).toEqual(["src/state/themeStore.ts"]);
  });

  it("lists exactly those modules, for both src and dist", () => {
    const expected = withEffects.flatMap((file) => [`./${file}`, `./${distPathFor(file)}`]).sort();
    expect([...manifest.sideEffects].sort()).toEqual(expected);
  });

  it("marks every module-scope style registration pure", () => {
    const unannotated: string[] = [];
    for (const file of files) {
      const sf = parse(file);
      const text = sf.getFullText();
      for (const statement of sf.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer;
          if (!init || !ts.isCallExpression(init)) continue;
          const callee = init.expression.getText(sf);
          if (callee !== "StyleSheet.create" && callee !== "createThemedStyles") continue;
          const leading = text.slice(init.getFullStart(), init.getStart(sf));
          if (!leading.includes("#__PURE__")) {
            unannotated.push(`${path.relative(srcRoot, file)}: ${declaration.name.getText(sf)}`);
          }
        }
      }
    }
    expect(unannotated).toEqual([]);
  });
});
