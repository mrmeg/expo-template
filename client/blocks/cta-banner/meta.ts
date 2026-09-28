import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "cta-banner",
  label: "CTA banner",
  description: "Headline, copy, and a single action",
  category: "marketing",
  recipe: ["StyledText", "Button"],
  icon: "arrow-right",
  order: 40,
};
