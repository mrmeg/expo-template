/** Web: `@rn-primitives/tooltip`, loaded through the one overlay chunk. See `lazyPart.tsx`. */
import { lazyPart, lazyRoot } from "./lazyPart";
import type * as Primitive from "@rn-primitives/tooltip";

export type * from "@rn-primitives/tooltip";

export const Root: typeof Primitive.Root = lazyRoot("tooltip", "Root");
export const Content: typeof Primitive.Content = lazyPart("tooltip", "Content");
export const Overlay: typeof Primitive.Overlay = lazyPart("tooltip", "Overlay");
export const Portal: typeof Primitive.Portal = lazyPart("tooltip", "Portal");
export const Trigger: typeof Primitive.Trigger = lazyPart("tooltip", "Trigger");
