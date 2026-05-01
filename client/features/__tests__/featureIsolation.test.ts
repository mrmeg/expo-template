/**
 * Feature isolation contract test.
 *
 * Pins the allowed cross-feature import edges documented in
 * `Agent/Docs/ARCHITECTURE.md`. Any new edge has to be opted in via
 * `ALLOWED_DEPENDENCIES` in `scripts/check-feature-isolation.js`,
 * which means the docs and the enforcement stay in lockstep.
 *
 * The script is also exposed as `bun run check:features` for local
 * use; this test makes the same scan part of the standard suite.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scan, ALLOWED_DEPENDENCIES } = require("@/scripts/check-feature-isolation");

interface Violation {
  from: string;
  to: string;
  file: string;
  policyReason: string;
}

interface ScanResult {
  features: string[];
  violations: Violation[];
}

describe("client/features cross-feature isolation", () => {
  const result: ScanResult = scan();

  it("flags zero disallowed cross-feature imports", () => {
    if (result.violations.length > 0) {
      const lines = result.violations.map(
        (v) =>
          `  - ${v.file}\n      imports @/client/features/${v.to}/...\n      from feature: ${v.from} (allowed: ${(ALLOWED_DEPENDENCIES[v.from]?.allowed ?? []).join(", ") || "none"})`,
      );
      throw new Error(
        `Disallowed cross-feature imports detected. Update ALLOWED_DEPENDENCIES in scripts/check-feature-isolation.js AND Agent/Docs/ARCHITECTURE.md if the new edge is intentional.\n\n${lines.join("\n\n")}`,
      );
    }
    expect(result.violations).toEqual([]);
  });

  it("documents every feature folder in ALLOWED_DEPENDENCIES (no silent additions)", () => {
    for (const feature of result.features) {
      expect(ALLOWED_DEPENDENCIES).toHaveProperty(feature);
    }
  });

  it("the documented shell-composition edges still exist (so the allowlist isn't stale)", () => {
    // App shell currently composes auth + onboarding via direct imports.
    expect(ALLOWED_DEPENDENCIES.app.allowed).toEqual(
      expect.arrayContaining(["auth", "onboarding"]),
    );
    // Billing currently consumes auth identity.
    expect(ALLOWED_DEPENDENCIES.billing.allowed).toEqual(
      expect.arrayContaining(["auth"]),
    );
  });
});
