import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "sign-in-form",
  label: "Sign-in form",
  description: "Credential card with separator and social buttons",
  category: "auth",
  recipe: ["Card", "Label", "TextInput", "Button", "Separator"],
  icon: "log-in",
  order: 60,
};
