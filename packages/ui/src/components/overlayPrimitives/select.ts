/** Web: `@rn-primitives/select`, loaded through the one overlay chunk. See `lazyPart.tsx`. */
import { lazyPart, lazyRoot } from "./lazyPart";
import type * as Primitive from "@rn-primitives/select";

export type * from "@rn-primitives/select";

export const Root: typeof Primitive.Root = lazyRoot("select", "Root");
export const Content: typeof Primitive.Content = lazyPart("select", "Content");
export const Group: typeof Primitive.Group = lazyPart("select", "Group");
export const Item: typeof Primitive.Item = lazyPart("select", "Item");
export const ItemIndicator: typeof Primitive.ItemIndicator = lazyPart("select", "ItemIndicator");
export const ItemText: typeof Primitive.ItemText = lazyPart("select", "ItemText");
export const Label: typeof Primitive.Label = lazyPart("select", "Label");
export const Overlay: typeof Primitive.Overlay = lazyPart("select", "Overlay");
export const Portal: typeof Primitive.Portal = lazyPart("select", "Portal");
export const Separator: typeof Primitive.Separator = lazyPart("select", "Separator");
export const Trigger: typeof Primitive.Trigger = lazyPart("select", "Trigger");
export const Value: typeof Primitive.Value = lazyPart("select", "Value");
