/**
 * Unit tests for the pure parts of `soak-check.mjs`. Run with
 * `node --test scripts/soak-check.test.mjs` (Jest does not pick up `.mjs`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildServerSpec, leastSquaresSlope, parseArgs, percentile } from "./soak-check.mjs";

test("slope of a perfect line is its gradient", () => {
  const points = [0, 100, 200, 300].map((x) => [x, 50 + 0.02 * x]);
  assert.ok(Math.abs(leastSquaresSlope(points) - 0.02) < 1e-12);
});

test("slope of flat data is zero", () => {
  assert.equal(leastSquaresSlope([[0, 80], [100, 80], [200, 80]]), 0);
});

test("slope is negative when memory falls", () => {
  assert.ok(leastSquaresSlope([[0, 90], [100, 80], [200, 70]]) < 0);
});

test("slope fits noisy data instead of using the end points", () => {
  // The end points alone give 0; the middle samples pull the fit upward.
  const slope = leastSquaresSlope([[0, 100], [100, 104], [200, 106], [300, 100]]);
  assert.ok(slope > 0 && slope < 0.05);
});

test("slope needs two points with distinct x", () => {
  assert.throws(() => leastSquaresSlope([[1, 1]]));
  assert.throws(() => leastSquaresSlope([[5, 1], [5, 2]]));
});

test("percentile uses nearest rank", () => {
  const values = [5, 1, 4, 2, 3, 10, 9, 8, 7, 6];
  assert.equal(percentile(values, 50), 5);
  assert.equal(percentile(values, 95), 10);
  assert.ok(Number.isNaN(percentile([], 50)));
});

test("server spec skips .env files and carries only the blank env", () => {
  const spec = buildServerSpec({
    port: 4321,
    env: { PATH: "/bin", HOME: "/home/x", SECRET_KEY: "nope", CLERK_SECRET_KEY: "nope" },
  });
  assert.equal(spec.command, "bun");
  assert.deepEqual(spec.args, ["--no-env-file", "./server.bun.ts"]);
  assert.deepEqual(spec.env, { NODE_ENV: "production", PORT: "4321", PATH: "/bin", HOME: "/home/x" });
});

test("parseArgs applies defaults and overrides", () => {
  const defaults = parseArgs([]);
  assert.equal(defaults.warmup, 500);
  assert.equal(defaults.requests, 3000);
  assert.equal(defaults.sampleEvery, 100);
  assert.equal(defaults.maxSlope, 20);
  const custom = parseArgs(["--routes=/,/a", "--warmup=0", "--requests=50", "--sample-every=10", "--max-slope=1.5"]);
  assert.deepEqual(custom.routes, ["/", "/a"]);
  assert.equal(custom.warmup, 0);
  assert.equal(custom.requests, 50);
  assert.equal(custom.maxSlope, 1.5);
});

test("parseArgs rejects bad input", () => {
  assert.throws(() => parseArgs(["--bogus=1"]));
  assert.throws(() => parseArgs(["--requests=abc"]));
  assert.throws(() => parseArgs(["--routes=nope"]));
  assert.throws(() => parseArgs(["requests=5"]));
});
