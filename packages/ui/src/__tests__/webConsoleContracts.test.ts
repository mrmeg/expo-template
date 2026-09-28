/**
 * Source contracts that keep the web console quiet.
 *
 * - `useNativeDriver: true` — RN's Animated has no native driver on web and
 *   logs "Animated: `useNativeDriver` is not supported…" per animation. Use
 *   `shouldUseNativeDriver` from `lib/animations`.
 * - A `pointerEvents` JSX prop — react-native-web deprecates the prop in favour
 *   of `style.pointerEvents` and warns on every page. Worse, the warning path
 *   lazily `require`s `warnOnce` inside `createDOMProps`, and on the dev
 *   server's first SSR render of a deep route that module load overflowed the
 *   stack (`RangeError: Maximum call stack size exceeded`, falling back to
 *   client rendering). `AnimatedView` still accepts the prop for consumers but
 *   folds it into `style`.
 *
 * Scans the kit source and the template's `app/` + `client/` trees.
 */
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ROOTS = ["packages/ui/src", "app", "client"];
const SOURCE = /\.(tsx?|jsx?)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules" || entry.name.endsWith(".generated.ts")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(path.join(REPO_ROOT, root)));

/** Lines that are code, not comment prose. */
function codeLines(file: string): Array<{ line: number; text: string }> {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text));
}

function offenders(pattern: RegExp, allow: (file: string, text: string) => boolean = () => false): string[] {
  const hits: string[] = [];
  for (const file of files) {
    for (const { line, text } of codeLines(file)) {
      if (pattern.test(text) && !allow(file, text)) hits.push(`${path.relative(REPO_ROOT, file)}:${line}: ${text.trim()}`);
    }
  }
  return hits;
}

describe("web console contracts", () => {
  it("scans the kit, app and client sources", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("never hard-codes useNativeDriver: true (use shouldUseNativeDriver)", () => {
    expect(offenders(/useNativeDriver:\s*true\b/)).toEqual([]);
  });

  it("never passes pointerEvents as a JSX prop (use style.pointerEvents)", () => {
    const allow = (file: string, text: string) =>
      // AnimatedView keeps the prop in its API for consumers and folds it into style.
      (file.endsWith("components/AnimatedView.tsx") && /pointerEvents\??:/.test(text)) ||
      // The Android-only @expo/ui Host in TextInput never renders on web.
      (file.endsWith("components/TextInput.tsx") && /<Host|pointerEvents=\{inLayout/.test(text));
    expect(offenders(/\bpointerEvents=/, allow)).toEqual([]);
  });
});
