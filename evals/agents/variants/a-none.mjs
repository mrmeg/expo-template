/**
 * Variant A: the base AGENTS.md and nothing else. What an agent knows about the
 * packages is what it finds by reading the code, the types, and the docs it
 * decides to look for.
 */
export default {
  id: "A",
  name: "none",
  order: 1,
  description: "base AGENTS.md only",
  /** @param {{ appDir: string }} context */
  async apply() {
    // The base guidance is already in place.
  },
};
