import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "faq-section",
  label: "FAQ section",
  description: "Heading above a single-open accordion",
  category: "content",
  recipe: ["SectionHeader", "Accordion", "StyledText"],
  icon: "circle-question-mark",
  order: 50,
};
