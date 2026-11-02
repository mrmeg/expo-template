/** Web: `@rn-primitives/alert-dialog`, loaded through the one overlay chunk. See `lazyPart.tsx`. */
import { lazyHook, lazyPart, lazyRoot } from "./lazyPart";
import type * as Primitive from "@rn-primitives/alert-dialog";

export type * from "@rn-primitives/alert-dialog";

export const Root: typeof Primitive.Root = lazyRoot("alertDialog", "Root");
export const Action: typeof Primitive.Action = lazyPart("alertDialog", "Action");
export const Cancel: typeof Primitive.Cancel = lazyPart("alertDialog", "Cancel");
export const Content: typeof Primitive.Content = lazyPart("alertDialog", "Content");
export const Description: typeof Primitive.Description = lazyPart("alertDialog", "Description");
export const Overlay: typeof Primitive.Overlay = lazyPart("alertDialog", "Overlay");
export const Portal: typeof Primitive.Portal = lazyPart("alertDialog", "Portal");
export const Title: typeof Primitive.Title = lazyPart("alertDialog", "Title");
export const Trigger: typeof Primitive.Trigger = lazyPart("alertDialog", "Trigger");
export const useRootContext: typeof Primitive.useRootContext = lazyHook("alertDialog", "useRootContext");
