import { appendFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Variant B: the base plus a pointer line, the style fieldnest uses: the agent
 * is told where the guide is and has to decide to read it.
 */
export default {
  id: "B",
  name: "pointer",
  order: 2,
  description: "base + a line pointing at node_modules/@mrmeg/expo-ui/LLM_USAGE.md",
  /** @param {{ appDir: string }} context */
  async apply({ appDir }) {
    appendFileSync(
      join(appDir, "AGENTS.md"),
      "\nRead `node_modules/@mrmeg/expo-ui/LLM_USAGE.md` before UI work.\n",
    );
  },
};
