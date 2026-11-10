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

Contrast is a second level (`standard` / `more`) beside it: `useTheme()` returns
`contrast` (resolved), `currentContrast` and `setContrast`; the preference is
`system` (follows the OS) unless set. Show it as a `Switch` in its own row
reading `contrast === "more"`, and on toggle call
`setContrast(desired === systemContrast ? "system" : desired)`. Tokens the app
overrides keep the app's value.
