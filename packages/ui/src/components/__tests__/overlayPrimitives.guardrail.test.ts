/**
 * The web overlay engines stay out of `__common` only while one `import()` reaches
 * them. A static import of `@rn-primitives/<overlay>` from a kit component, or of
 * `engine.ts` from anywhere but `lazyPart.tsx`, silently moves the Radix and
 * floating-ui graph back into every route's first download. Nothing fails at
 * runtime, so this test reads the sources.
 */
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../..");
const OVERLAYS = ["alert-dialog", "dialog", "dropdown-menu", "popover", "select", "tooltip"];

function sources(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const all = sources(SRC).map((file) => ({
  file: path.relative(SRC, file),
  text: fs.readFileSync(file, "utf-8"),
}));
const isNative = (file: string) => file.endsWith(".native.ts");

describe("overlay primitives split point", () => {
  it("only the engine and native files import the overlay packages as values", () => {
    const offenders = all
      .filter(({ file }) => file !== "components/overlayPrimitives/engine.ts" && !isNative(file))
      .filter(({ text }) =>
        OVERLAYS.some((name) =>
          new RegExp(`^\\s*(import|export)\\s+(?!type\\b)[^;]*?from\\s+"@rn-primitives/${name}"`, "m").test(text)
        )
      )
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("only lazyPart reaches the engine, through one import()", () => {
    const importers = all
      .filter(({ text }) => /["']\.\/(overlayPrimitives\/)?engine["']/.test(text))
      .map(({ file }) => file);

    expect(importers).toEqual(["components/overlayPrimitives/lazyPart.tsx"]);
    const lazy = all.find(({ file }) => file === importers[0])!.text;
    expect(lazy.match(/(?<!typeof )import\("\.\/engine"\)/g)).toHaveLength(1);
  });
});
