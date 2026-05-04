#!/usr/bin/env node

/**
 * Bundle size check script.
 *
 * Usage:
 *   node scripts/check-bundle-size.js          # Compare against baseline
 *   node scripts/check-bundle-size.js --update  # Set current size as baseline
 *
 * Expects dist/client to already exist (run `bun run build` first).
 * Uses only Node.js built-ins — no external dependencies.
 */

const fs = require("fs");
const path = require("path");

const THRESHOLD = 0.10; // 10% growth allowed
const DIST_DIR = path.join(process.cwd(), "dist", "client");
const BASELINE_PATH = path.join(__dirname, "bundle-baseline.json");
const BASELINE_METRIC = "budgeted client JS excluding known optional lazy chunks";

const LAZY_CHUNK_EXCLUSIONS = [
  {
    label: "optional HEIC conversion",
    pattern: /^heic2any-[^/\\]+\.js$/,
  },
  {
    label: "optional native video thumbnail adapter",
    pattern: /^VideoThumbnails-[^/\\]+\.js$/,
  },
];

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

function getLazyChunkExclusion(file) {
  const fileName = path.basename(file);
  return LAZY_CHUNK_EXCLUSIONS.find(({ pattern }) => pattern.test(fileName)) ?? null;
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
    metric: BASELINE_METRIC,
    lastUpdated: new Date().toISOString(),
    note: "Run 'bun run bundle-size --update' to update after intentional eager bundle size changes",
    excludedLazyChunkPatterns: LAZY_CHUNK_EXCLUSIONS.map(({ pattern }) => pattern.source),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + "\n");
}

// Main
const jsFiles = getJsFiles(DIST_DIR);

if (jsFiles.length === 0) {
  console.error("No JS files found in dist/client. Run 'bun run build' first.");
  process.exit(1);
}

const jsFileStats = jsFiles.map((file) => ({
  file,
  size: fs.statSync(file).size,
  exclusion: getLazyChunkExclusion(file),
}));
const budgetedFiles = jsFileStats.filter(({ exclusion }) => !exclusion);
const excludedLazyFiles = jsFileStats.filter(({ exclusion }) => exclusion);
const totalBytes = budgetedFiles.reduce((sum, { size }) => sum + size, 0);
const allBytes = jsFileStats.reduce((sum, { size }) => sum + size, 0);
const excludedLazyBytes = excludedLazyFiles.reduce((sum, { size }) => sum + size, 0);

console.log(`Bundle size: ${formatBytes(totalBytes)} (${totalBytes} bytes)`);
console.log(`Total JS size: ${formatBytes(allBytes)} (${allBytes} bytes)`);
console.log(`JS files: ${budgetedFiles.length} budgeted, ${jsFiles.length} total`);

if (excludedLazyFiles.length > 0) {
  console.log(
    `Excluded lazy chunks: ${formatBytes(excludedLazyBytes)} (${excludedLazyBytes} bytes)`
  );
  for (const { file, size, exclusion } of excludedLazyFiles.sort((a, b) => b.size - a.size)) {
    console.log(
      `  - ${path.relative(DIST_DIR, file)}: ${formatBytes(size)} (${exclusion.label})`
    );
  }
}

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

const baselineMetric = baseline.metric ?? BASELINE_METRIC;
console.log(
  `Baseline: ${formatBytes(baseline.totalBytes)} (${baselineMetric}, set ${baseline.lastUpdated})`
);
console.log(`Growth: ${growthPercent}% (threshold: ${THRESHOLD * 100}%)`);

if (growth > THRESHOLD) {
  console.error(
    "\nBundle size exceeded threshold! " +
    `Current: ${formatBytes(totalBytes)}, ` +
    `Baseline: ${formatBytes(baseline.totalBytes)}, ` +
    `Growth: ${growthPercent}%`
  );
  process.exit(1);
} else {
  console.log("Bundle size within budget.");
  process.exit(0);
}
