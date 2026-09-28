import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "stat-row",
  label: "Stat row",
  description: "Metrics with change indicators, split by hairlines",
  category: "data",
  recipe: ["SectionHeader", "StyledText", "Icon"],
  icon: "chart-no-axes-column",
  order: 30,
};
