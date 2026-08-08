import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "cta-banner",
  label: "CTA banner",
  description: "Accent card with copy and a single action",
  category: "marketing",
  recipe: ["Card", "Button", "StyledText"],
  icon: "arrow-right",
  order: 40,
};
