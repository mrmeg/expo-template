#!/usr/bin/env node
/**
 * Render the brand rasters from the SVG masters in `assets/brand/`.
 *
 * `app.config.ts` points at PNGs (Expo's icon and splash pipelines take no
 * SVG), so every raster in `assets/images/` is a build product of one master
 * here. Edit the SVG, run `bun run brand:assets`, commit both. Rendering uses
 * librsvg's `rsvg-convert` (Homebrew: `brew install librsvg`); the output is
 * byte-stable for an unchanged master, so a re-run leaves `git status` clean.
 *
 * `__tests__/brandAssets.test.ts` pins the sizes below.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const masters = join(root, "assets", "brand");
const out = join(root, "assets", "images");

/** master → [output, size] */
const RENDERS = [
  ["mark.svg", "icon.png", 1024],
  ["mark-dark.svg", "icon-dark.png", 1024],
  ["mark-tinted.svg", "icon-tinted.png", 1024],
  ["adaptive-foreground.svg", "adaptive-icon.png", 1024],
  ["adaptive-monochrome.svg", "adaptive-icon-monochrome.png", 1024],
  ["splash-light.svg", "splash-icon.png", 1024],
  ["splash-dark.svg", "splash-icon-dark.png", 1024],
  ["favicon.svg", "favicon.png", 48],
];

function findRenderer() {
  const candidates = [process.env.RSVG_CONVERT, "rsvg-convert", "/opt/homebrew/bin/rsvg-convert", "/usr/local/bin/rsvg-convert"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error("rsvg-convert not found. Install librsvg (brew install librsvg) or set RSVG_CONVERT.");
}

const renderer = findRenderer();
for (const [master, output, size] of RENDERS) {
  const input = join(masters, master);
  if (!existsSync(input)) throw new Error(`Missing master ${input}`);
  execFileSync(renderer, ["-w", String(size), "-h", String(size), "-o", join(out, output), input], { stdio: "inherit" });
  console.log(`rendered ${output} (${size}px) from ${master}`);
}
