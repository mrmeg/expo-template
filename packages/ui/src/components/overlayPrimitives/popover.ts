/** Web: `@rn-primitives/popover`, loaded through the one overlay chunk. See `lazyPart.tsx`. */
import { lazyHook, lazyPart, lazyRoot } from "./lazyPart";
import type * as Primitive from "@rn-primitives/popover";

export type * from "@rn-primitives/popover";

export const Root: typeof Primitive.Root = lazyRoot("popover", "Root");
export const Content: typeof Primitive.Content = lazyPart("popover", "Content");
export const Overlay: typeof Primitive.Overlay = lazyPart("popover", "Overlay");
export const Portal: typeof Primitive.Portal = lazyPart("popover", "Portal");
export const Trigger: typeof Primitive.Trigger = lazyPart("popover", "Trigger");
export const useRootContext: typeof Primitive.useRootContext = lazyHook("popover", "useRootContext");
