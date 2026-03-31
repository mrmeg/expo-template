#!/usr/bin/env node

/**
 * Bundle size check script.
 *
 * Usage:
 *   node scripts/check-bundle-size.js          # Compare against baseline
 *   node scripts/check-bundle-size.js --update  # Set current size as baseline
 *
 * Expects dist/ to already exist (run `bun run build` first).
 * Uses only Node.js built-ins — no external dependencies.
 */

const fs = require("fs");
const path = require("path");

const THRESHOLD = 0.10; // 10% growth allowed
const DIST_DIR = path.join(process.cwd(), "dist");
const BASELINE_PATH = path.join(__dirname, "bundle-baseline.json");

function getJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getJsFiles(fullPath));
    } else if (entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return { totalBytes: 0, lastUpdated: "", note: "" };
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
}

function writeBaseline(totalBytes) {
  const data = {
    totalBytes,
    lastUpdated: new Date().toISOString(),
    note: "Run 'bun run bundle-size --update' to update after intentional size changes",
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + "\n");
}

// Main
const jsFiles = getJsFiles(DIST_DIR);

if (jsFiles.length === 0) {
  console.error("No JS files found in dist/. Run 'bun run build' first.");
  process.exit(1);
}

const totalBytes = jsFiles.reduce((sum, file) => {
  return sum + fs.statSync(file).size;
}, 0);

console.log(`Bundle size: ${formatBytes(totalBytes)} (${totalBytes} bytes)`);
console.log(`JS files: ${jsFiles.length}`);

const isUpdate = process.argv.includes("--update");

if (isUpdate) {
  writeBaseline(totalBytes);
  console.log(`Baseline updated to ${formatBytes(totalBytes)}`);
  process.exit(0);
}

const baseline = readBaseline();

if (baseline.totalBytes === 0) {
  console.log("No baseline set. Run 'bun run bundle-size --update' to establish one.");
  process.exit(0);
}

const growth = (totalBytes - baseline.totalBytes) / baseline.totalBytes;
const growthPercent = (growth * 100).toFixed(1);

console.log(`Baseline: ${formatBytes(baseline.totalBytes)} (set ${baseline.lastUpdated})`);
console.log(`Growth: ${growthPercent}% (threshold: ${THRESHOLD * 100}%)`);

if (growth > THRESHOLD) {
  console.error(
    `\nBundle size exceeded threshold! ` +
    `Current: ${formatBytes(totalBytes)}, ` +
    `Baseline: ${formatBytes(baseline.totalBytes)}, ` +
    `Growth: ${growthPercent}%`
  );
  process.exit(1);
} else {
  console.log("Bundle size within budget.");
  process.exit(0);
}
