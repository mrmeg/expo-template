---
components: [Hydrated]
use-for: "Holding a Radix-backed subtree on a server-rendered web route until hydration, to avoid a `useId` mismatch"
instead-of: "Branching on `typeof window`"
---

# Hydrated

A Radix-backed component (`Tabs`, `Accordion`, `Collapsible`, `Select`, `DropdownMenu`, `Popover`) on a server-rendered web route logs a `useId` hydration mismatch (Expo Router hydrates `#root`, the server rendered `+html.tsx`). Wrap that subtree — not the page — in `<Hydrated fallback={…}>` (`@mrmeg/expo-ui/components`) with a fallback that holds its height; never branch on `typeof window`. Content that must be in the server HTML stays outside the gate.
