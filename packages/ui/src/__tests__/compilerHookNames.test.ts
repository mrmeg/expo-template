/**
 * React Compiler hook-name guard.
 *
 * The compiler recognizes hooks only by a `use`-prefixed callee. A zustand
 * store whose name lacks the prefix (`globalUIStore`) is still a hook when
 * called, but the compiler reads `globalUIStore()` as a plain function call,
 * caches its result, and skips it on the next render: React then sees a
 * different hook order and throws error #311. `Notification` did exactly this
 * once it started compiling. Components must read such stores through
 * zustand's `useStore(store, selector)`; `.getState()`, `.setState()` and
 * `.subscribe()` stay fine anywhere.
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const srcRoot = path.join(__dirname, "..");

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

/** Names of module-level `const x = create(...)` zustand stores. */
function zustandStores(files: string[]): string[] {
  const names: string[] = [];
  for (const file of files) {
    const sf = parse(file);
    for (const statement of sf.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer;
        if (init && ts.isCallExpression(init) && init.expression.getText(sf) === "create") {
          names.push(declaration.name.getText(sf));
        }
      }
    }
  }
  return names;
}

describe("hooks the React Compiler can't recognize", () => {
  const files = sourceFiles(srcRoot);
  const stores = zustandStores(files);

  it("finds the package's zustand stores", () => {
    expect(stores.sort()).toEqual(["globalUIStore", "useFeedbackStore", "useThemeStore"]);
  });

  it("never calls a store whose name lacks the `use` prefix directly", () => {
    const unprefixed = new Set(stores.filter((name) => !name.startsWith("use")));
    const calls: string[] = [];
    for (const file of files) {
      const sf = parse(file);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && unprefixed.has(node.expression.text)) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          calls.push(`${path.relative(srcRoot, file)}:${line} ${node.getText(sf)}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(calls).toEqual([]);
  });
});
