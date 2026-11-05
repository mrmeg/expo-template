---
components: [ThemeSelector]
use-for: "System / Light / Dark switch wired to the theme store; icon-only fits an `ItemActions` slot, `showLabels` stretches"
instead-of: "Three radio rows or a hand-rolled theme picker"
---

# ThemeSelector

A settings screen picks the theme with one row: `ThemeSelector` in the row's
`ItemActions`, with translated `labels`. It reads and writes `useThemeStore`, so
it needs no state of its own. Describe the resolved scheme under the title only
while the preference is `system`.
