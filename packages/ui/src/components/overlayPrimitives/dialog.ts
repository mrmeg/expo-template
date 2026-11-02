/** Web: `@rn-primitives/dialog`, loaded through the one overlay chunk. See `lazyPart.tsx`. */
import { lazyHook, lazyPart, lazyRoot } from "./lazyPart";
import type * as Primitive from "@rn-primitives/dialog";

export type * from "@rn-primitives/dialog";

export const Root: typeof Primitive.Root = lazyRoot("dialog", "Root");
export const Close: typeof Primitive.Close = lazyPart("dialog", "Close");
export const Content: typeof Primitive.Content = lazyPart("dialog", "Content");
export const Description: typeof Primitive.Description = lazyPart("dialog", "Description");
export const Overlay: typeof Primitive.Overlay = lazyPart("dialog", "Overlay");
export const Portal: typeof Primitive.Portal = lazyPart("dialog", "Portal");
export const Title: typeof Primitive.Title = lazyPart("dialog", "Title");
export const Trigger: typeof Primitive.Trigger = lazyPart("dialog", "Trigger");
export const useRootContext: typeof Primitive.useRootContext = lazyHook("dialog", "useRootContext");
