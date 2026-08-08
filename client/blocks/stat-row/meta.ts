import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "stat-row",
  label: "Stat row",
  description: "StatCard row with change indicators",
  category: "data",
  recipe: ["StatCard", "SectionHeader"],
  icon: "bar-chart-2",
  order: 30,
};
