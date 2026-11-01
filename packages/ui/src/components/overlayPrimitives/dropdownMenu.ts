/** Web: `@rn-primitives/dropdown-menu`, loaded through the one overlay chunk. See `lazyPart.tsx`. */
import { lazyHook, lazyPart, lazyRoot } from "./lazyPart";
import type * as Primitive from "@rn-primitives/dropdown-menu";

export type * from "@rn-primitives/dropdown-menu";

export const Root: typeof Primitive.Root = lazyRoot("dropdownMenu", "Root");
export const CheckboxItem: typeof Primitive.CheckboxItem = lazyPart("dropdownMenu", "CheckboxItem");
export const Content: typeof Primitive.Content = lazyPart("dropdownMenu", "Content");
export const Group: typeof Primitive.Group = lazyPart("dropdownMenu", "Group");
export const Item: typeof Primitive.Item = lazyPart("dropdownMenu", "Item");
export const ItemIndicator: typeof Primitive.ItemIndicator = lazyPart("dropdownMenu", "ItemIndicator");
export const Label: typeof Primitive.Label = lazyPart("dropdownMenu", "Label");
export const Overlay: typeof Primitive.Overlay = lazyPart("dropdownMenu", "Overlay");
export const Portal: typeof Primitive.Portal = lazyPart("dropdownMenu", "Portal");
export const RadioGroup: typeof Primitive.RadioGroup = lazyPart("dropdownMenu", "RadioGroup");
export const RadioItem: typeof Primitive.RadioItem = lazyPart("dropdownMenu", "RadioItem");
export const Separator: typeof Primitive.Separator = lazyPart("dropdownMenu", "Separator");
export const Sub: typeof Primitive.Sub = lazyPart("dropdownMenu", "Sub");
export const SubContent: typeof Primitive.SubContent = lazyPart("dropdownMenu", "SubContent");
export const SubTrigger: typeof Primitive.SubTrigger = lazyPart("dropdownMenu", "SubTrigger");
export const Trigger: typeof Primitive.Trigger = lazyPart("dropdownMenu", "Trigger");
export const useSubContext: typeof Primitive.useSubContext = lazyHook("dropdownMenu", "useSubContext");
