---
components: [Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator]
use-for: "Option menus"
instead-of: "Custom dropdowns"
---

# Select

`SelectContent` requires root `UIProvider` portal host; `label` drives default item text.

On a server-rendered web route it logs a `useId` hydration mismatch: see [Hydrated](Hydrated.md).
