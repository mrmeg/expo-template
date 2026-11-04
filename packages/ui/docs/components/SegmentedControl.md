---
components: [SegmentedControl]
use-for: "Native segmented picker (`@expo/ui`); `size=\"lg\"` = 44 pt drawn control; a value not in `values` selects none"
instead-of: "Custom segmented views"
---

# SegmentedControl

`md` (default) is the native `@expo/ui` control on iOS/Android (about 32 pt on iOS, the 40 dp Material 3 segmented button on Android; the platform owns its look). Web, and `size="lg"` on every platform, draw the kit control from theme tokens (`lg` is 44 pt; `appearance` is ignored). A `value` (or `defaultValue`) not in `values` selects no segment.
