/**
 * Expo's tree shaker removes `import "intl-pluralrules"` from production bundles,
 * while dev keeps it, so only a release would show the missing polyfill. It must
 * stay a `require` inside the function the i18n module calls.
 */
import fs from "fs";
import path from "path";

const I18N = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(I18N, file), "utf-8");

describe("plural rules polyfill", () => {
  it("is never a bare import", () => {
    expect(read("index.ts")).not.toMatch(/^\s*import\s+["']intl-pluralrules["']/m);
    expect(read("pluralRules.native.ts")).not.toMatch(/^\s*import\s+["']intl-pluralrules["']/m);
  });

  it("loads through a call the i18n module makes", () => {
    expect(read("index.ts")).toMatch(/^installPluralRules\(\);$/m);
    expect(read("pluralRules.native.ts")).toContain('require("intl-pluralrules")');
  });

  it("stays out of the web file", () => {
    expect(read("pluralRules.ts")).not.toContain('"intl-pluralrules"');
  });
});
