import { createContext, use } from "react";

import type { DemoDisplay } from "../looks";

/** The selected look's demo-only presentation, read by the sample screens. */
export const LookDisplayContext = createContext<DemoDisplay | null>(null);

export function useLookDisplay(): DemoDisplay {
  const display = use(LookDisplayContext);
  if (!display) throw new Error("useLookDisplay needs a LookDisplayContext provider");
  return display;
}

export type SampleScreen = "home" | "settings";
