#!/usr/bin/env node
/**
 * Feature isolation check.
 *
 * Walks `client/features/<f>` for every feature and flags imports of
 * `@/client/features/<g>/...` where `g !== f` AND the dependency isn't on
 * the allowlist below. The allowlist documents the actual shell-level
 * composition the template ships with — it is the source of truth that
 * `Agent/Docs/ARCHITECTURE.md` describes in prose.
 *
 * Run via `bun run check:features` or as part of `bun jest` (the
 * `client/features/__tests__/featureIsolation.test.ts` suite invokes
 * the same scanner so violations surface in CI even when the script
 * isn't run separately).
 *
 * Exit code: 0 when clean, 1 on any disallowed import.
 */

const fs = require("fs");
const path = require("path");

/**
 * Each feature lists features it is *allowed* to import. Anything not
 * in the list is a violation. Updating this map without also updating
 * `Agent/Docs/ARCHITECTURE.md` will leave docs and reality out of sync,
 * which is exactly the drift this whole spec exists to prevent.
 */
const ALLOWED_DEPENDENCIES = {
  app: {
    allowed: ["auth", "onboarding"],
    reason:
      "Shell composition layer — `useAppStartup`, `OnboardingGate`, and `AuthGate` orchestrate the auth and onboarding features at startup.",
  },
  billing: {
    allowed: ["auth"],
    reason:
      "Identity-only — billing hooks read `useAuthStore` to learn whether the viewer is signed in. They never touch auth UI components.",
  },
  // No entry == no allowed cross-feature imports.
  auth: { allowed: [], reason: "Self-contained." },
  onboarding: { allowed: [], reason: "Self-contained." },
  media: { allowed: [], reason: "Self-contained." },
  i18n: { allowed: [], reason: "Self-contained." },
  notifications: { allowed: [], reason: "Self-contained." },
  navigation: { allowed: [], reason: "Self-contained." },
  keyboard: { allowed: [], reason: "Self-contained." },
};

const FEATURES_ROOT = path.join(__dirname, "..", "client", "features");
const IMPORT_RE = /from\s+["']@\/client\/features\/([a-z][a-z0-9-]*)/g;

function listFeatures() {
  return fs
    .readdirSync(FEATURES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "__tests__")
    .map((d) => d.name)
    .sort();
}

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function findCrossFeatureImports(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const out = [];
  let match;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    out.push(match[1]);
  }
  return out;
}

function scan() {
  const features = listFeatures();
  const violations = [];

  for (const feature of features) {
    const featureDir = path.join(FEATURES_ROOT, feature);
    const files = walkFiles(featureDir);
    const policy = ALLOWED_DEPENDENCIES[feature] || { allowed: [], reason: "Unlisted feature — defaults to self-contained." };

    for (const file of files) {
      const targets = findCrossFeatureImports(file);
      for (const target of targets) {
        if (target === feature) continue;
        if (policy.allowed.includes(target)) continue;
        violations.push({
          from: feature,
          to: target,
          file: path.relative(path.join(__dirname, ".."), file),
          policyReason: policy.reason,
        });
      }
    }
  }

  return { features, violations };
}

function formatViolation(v) {
  return [
    `  ${v.file}`,
    `    imports: @/client/features/${v.to}/...`,
    `    feature: ${v.from} (allowed: ${(ALLOWED_DEPENDENCIES[v.from]?.allowed || []).join(", ") || "none"})`,
  ].join("\n");
}

if (require.main === module) {
  const { features, violations } = scan();
  if (violations.length === 0) {
    console.log(`✓ Feature isolation OK across ${features.length} features.`);
    process.exit(0);
  }
  console.error(`✗ ${violations.length} disallowed cross-feature import(s):\n`);
  for (const v of violations) console.error(formatViolation(v) + "\n");
  console.error("Update the allowlist in scripts/check-feature-isolation.js");
  console.error("AND Agent/Docs/ARCHITECTURE.md if the new edge is intentional.");
  process.exit(1);
}

module.exports = { scan, ALLOWED_DEPENDENCIES };
