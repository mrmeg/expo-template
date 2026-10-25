import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * `bun install` in a throwaway consumer fixture, bounded and retried.
 *
 * On GitHub's runners bun 1.3.14 sometimes stalls at "Resolving dependencies"
 * with no further output and no exit, until the job's own timeout cancels it.
 * The ui fixtures hit it on 2026-10-24 and 2026-10-25, and it blocked the
 * @mrmeg/expo-ui 0.31.0 publish twice. The same install finishes in about 10 s
 * locally and in linux/amd64 and linux/arm64 oven/bun containers, and a rerun
 * often passes. So a stalled attempt is killed after `timeoutMs` and retried
 * from a clean fixture (no `node_modules`, no `bun.lock`). A real failure, a
 * non-zero exit that isn't a timeout, is never retried.
 *
 * @param {string[]} args arguments after `bun`, e.g. `["install"]`
 * @param {string} cwd the fixture directory
 * @param {{ attempts?: number, timeoutMs?: number, command?: string }} [options]
 */
export function bunInstallWithRetry(args, cwd, { attempts = 3, timeoutMs = 300_000, command = "bun" } = {}) {
  const label = `${command} ${args.join(" ")}`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(command, args, { cwd, stdio: "inherit", timeout: timeoutMs, killSignal: "SIGKILL" });
    if (result.status === 0) return attempt;

    const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGKILL";
    if (!timedOut) {
      throw new Error(`${label} failed with status ${result.status}`);
    }
    if (attempt === attempts) {
      throw new Error(`${label} stalled past ${timeoutMs / 1000} s on all ${attempts} attempts`);
    }

    console.warn(`${label} stalled past ${timeoutMs / 1000} s (attempt ${attempt} of ${attempts}); retrying from a clean fixture`);
    rmSync(join(cwd, "node_modules"), { recursive: true, force: true });
    rmSync(join(cwd, "bun.lock"), { force: true });
  }
}
