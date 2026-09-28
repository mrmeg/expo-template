import type { BlockEntry } from "../types";

export const meta: BlockEntry = {
  id: "sign-in-form",
  label: "Sign-in form",
  description: "Credential form with separator and social buttons",
  category: "auth",
  recipe: ["Label", "TextInput", "Button", "Separator", "StyledText"],
  icon: "log-in",
  order: 60,
};
