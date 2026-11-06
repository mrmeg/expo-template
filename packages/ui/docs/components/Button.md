---
components: [Button, ButtonText, ButtonIcon]
use-for: "Commands and CTAs"
instead-of: "Pressable plus custom text styling"
---

# Button

- `disabled` blocks the press (no `onPress`, no scale/haptic, out of the web tab order). To keep a button focusable and pressable while announced and dimmed as disabled — so the press can explain why — use `aria-disabled` (or `accessibilityState={{ disabled: true }}`), never a hand-rolled opacity style.

- The default radius is 8 (`spacing.radiusSm`, retuned through `setShape({ button })`). The `link` preset's text is the `link` color token, not `accent`, and the `default` preset's shadow is the hairline `subtle` (none in dark).

- Use `Button size="sm"` for compact popover, tooltip, and toolbar triggers; nested `StyledText` inherits the Button size.
