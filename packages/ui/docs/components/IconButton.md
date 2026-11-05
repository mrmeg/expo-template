---
components: [IconButton]
use-for: "Icon-only command; `accessibilityLabel` required; ≥44 pt hit area; adjacent `sm` IconButtons need a ≥16 pt gap (hit slop extends 8 pt)"
instead-of: "`Button` with only an `Icon` child, or a raw `Pressable` + `Icon`"
---

# IconButton

Use when: Icon-only commands (refresh, close, toolbar).

`accessibilityLabel` is required; `Button` presets, `square` or `circle`, 44 pt hit area everywhere. Adjacent `sm` IconButtons need a 16 pt gap (their hit slop reaches 8 pt out). Never a `Button` with only an `Icon` child.
