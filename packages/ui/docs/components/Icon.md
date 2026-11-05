---
components: [Icon]
use-for: "Registered Lucide glyphs or custom art with theme tokens"
instead-of: "Raw vector icons with hardcoded colors"
---

# Icon

- `Icon` and `Button.Icon` take `name` (a kebab-case Lucide name typed `IconName`: the package builtins plus the names the app lists in `client/icons.json`, compiled with `bunx expo-ui-icons` and registered once with `registerIcons(appIcons)` at module scope in the root layout) or `component` (an `IconComponent` taking `size` and `color`, for art that is not a Lucide icon). Both are sized, colored with theme tokens, and hidden from assistive tech unless `accessibilityLabel` names a standalone icon (`decorative` only silences a labelled one); `Button.Icon` inherits the button's label color and is decorative by default. A missing name is a type error: run `bunx expo-ui-icons add <name>` (it maps an alias such as `home` to `house`) rather than importing an icon library. Check a name that arrives at runtime with `isIconName`.

Icons are SVG drawn from glyph data, so there is no icon font to load.
