import { spawnSync } from "node:child_process";

/**
 * Variant C: the base plus the compact index of every installed @mrmeg package,
 * written by the package's own `expo-ui-agents` bin from the installed tarballs:
 * the guidance is in the agent's context from the first turn.
 */
export default {
  id: "C",
  name: "inline-index",
  order: 3,
  description: "base + the section `bunx expo-ui-agents` writes from the installed packages",
  /** @param {{ appDir: string }} context */
  async apply({ appDir }) {
    const result = spawnSync("bunx", ["expo-ui-agents"], { cwd: appDir, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`bunx expo-ui-agents failed with status ${result.status}: ${result.stdout}${result.stderr}`);
    }
  },
};
