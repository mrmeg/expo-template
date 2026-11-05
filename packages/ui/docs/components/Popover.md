---
components: [Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverBody, PopoverFooter]
use-for: "Anchored contextual content"
instead-of: "Custom anchored views"
---

# Popover

Requires root `UIProvider` portal host.

`PopoverContent` treats `side` as a preference: on iOS and Android it opens on
the other side when the content does not fit and there is more room there,
caps its height to the room and scrolls the children (pass `scrollable={false}`
for content with its own `FlatList`; it then stays on `side`). `insets` default
to the safe area, and a `style` merges over the themed surface rather than
replacing it. A `PopoverTrigger` ref (`PopoverTriggerRef`) has `open()` / `close()`.

On a server-rendered web route it logs a `useId` hydration mismatch: see [Hydrated](Hydrated.md).
