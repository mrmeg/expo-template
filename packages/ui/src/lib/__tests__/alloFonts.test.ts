/**
 * The three native Allo font maps register exactly the faces
 * `sansPresetFamilies[preset].native` names, each `require`d from its own
 * file in `fonts/allo/native/`. The web variants are empty: web loads the
 * faces from a stylesheet, and a `require`d TTF would still be emitted as a
 * web asset.
 *
 * jest-expo maps asset `require`s to a stub, so file existence is checked on
 * disk and in the `require` paths of each source, not through the values.
 */
import fs from "fs";
import path from "path";

import { sansPresetFamilies, type SansPreset } from "../../constants/fonts";
import { alloFonts as alloFontsNative } from "../alloFonts.native";
import { alloFriendlyFonts as alloFriendlyFontsNative } from "../alloFriendlyFonts.native";
import { alloRoundFonts as alloRoundFontsNative } from "../alloRoundFonts.native";

const libDir = path.join(__dirname, "..");
const nativeDir = path.join(__dirname, "..", "..", "fonts", "allo", "native");

const MAPS: [SansPreset, string, Readonly<Record<string, number>>][] = [
  ["allo", "alloFonts", alloFontsNative],
  ["allo-friendly", "alloFriendlyFonts", alloFriendlyFontsNative],
  ["allo-round", "alloRoundFonts", alloRoundFontsNative],
];

describe("native Allo font maps", () => {
  it.each(MAPS)("the %s map registers exactly the faces its preset names", (preset, _module, map) => {
    const names = [...new Set(Object.values(sansPresetFamilies[preset].native))].sort();
    expect(Object.keys(map).sort()).toEqual(names);
    expect(names).toHaveLength(4);
  });

  it.each(MAPS)("each %s face has its .ttf in fonts/allo/native", (_preset, _module, map) => {
    for (const name of Object.keys(map)) {
      expect(fs.existsSync(path.join(nativeDir, `${name}.ttf`))).toBe(true);
    }
  });

  it.each(MAPS)("the %s map (%s.native.ts) requires each face from its own file", (_preset, module, map) => {
    const source = fs.readFileSync(path.join(libDir, `${module}.native.ts`), "utf8");
    const entries = [...source.matchAll(/(\w+):\s*require\("\.\.\/fonts\/allo\/native\/([^"]+)\.ttf"\)/g)]
      .map((match) => [match[1], match[2]]);

    expect(entries).toHaveLength(Object.keys(map).length);
    for (const [key, file] of entries) {
      expect(file).toBe(key);
    }
  });
});

describe("web Allo font maps", () => {
  it.each(MAPS)("the %s map is empty on web (%s.ts)", (_preset, module) => {
    const web = jest.requireActual<Record<string, unknown>>(path.join(libDir, `${module}.ts`));
    expect(web[module]).toEqual({});
  });
});
