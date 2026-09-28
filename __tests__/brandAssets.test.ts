/**
 * The template ships a real mark, not Expo's placeholder art: every raster the
 * config points at is rendered from the SVG masters under `assets/brand/` at
 * the size its slot expects, and `app.config.ts` wires the scheme variants.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import appConfig from "../app.config";

const root = join(__dirname, "..");

function pngSize(relativePath: string): { width: number; height: number } {
  const bytes = readFileSync(join(root, relativePath));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const RASTERS: Record<string, number> = {
  "assets/images/icon.png": 1024,
  "assets/images/icon-dark.png": 1024,
  "assets/images/icon-tinted.png": 1024,
  "assets/images/adaptive-icon.png": 1024,
  "assets/images/adaptive-icon-monochrome.png": 1024,
  "assets/images/splash-icon.png": 1024,
  "assets/images/splash-icon-dark.png": 1024,
  "assets/images/favicon.png": 48,
};

const MASTERS = [
  "mark.svg",
  "mark-dark.svg",
  "mark-tinted.svg",
  "adaptive-foreground.svg",
  "adaptive-monochrome.svg",
  "splash-light.svg",
  "splash-dark.svg",
  "favicon.svg",
];

describe("brand assets", () => {
  it.each(Object.entries(RASTERS))("%s is a %ipx square PNG", (path, size) => {
    expect(pngSize(path)).toEqual({ width: size, height: size });
  });

  it("keeps an SVG master for every raster", () => {
    for (const master of MASTERS) {
      expect(existsSync(join(root, "assets/brand", master))).toBe(true);
    }
  });

  it("no longer ships the Expo placeholder react logo", () => {
    expect(existsSync(join(root, "assets/images/partial-react-logo.png"))).toBe(false);
  });

  it("wires the light, dark and tinted icons, the adaptive icon, and the splash variants", () => {
    const config = appConfig({ config: {}, projectRoot: root, staticConfigPath: null, packageJsonPath: null } as never);
    expect(config.icon).toBe("./assets/images/icon.png");
    expect(config.ios?.icon).toEqual({
      light: "./assets/images/icon.png",
      dark: "./assets/images/icon-dark.png",
      tinted: "./assets/images/icon-tinted.png",
    });
    expect(config.android?.adaptiveIcon).toEqual({
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/adaptive-icon-monochrome.png",
      backgroundColor: "#09090B",
    });
    expect(config.web?.favicon).toBe("./assets/images/favicon.png");
    const splash = (config.plugins ?? []).find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
    ) as [string, Record<string, unknown>] | undefined;
    expect(splash?.[1]).toEqual({
      image: "./assets/images/splash-icon.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
      dark: {
        image: "./assets/images/splash-icon-dark.png",
        backgroundColor: "#09090B",
      },
    });
  });
});
