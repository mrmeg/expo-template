---
components: [Carousel]
use-for: "Horizontally snapping slide row with pressable dots"
instead-of: "Snap `ScrollView` plus manual offset math"
---

# Carousel

- `Carousel` for a horizontal snap row of a known, small set of slides. It renders every child (no virtualization), so slides survive into the exported HTML shell and the first client frame; use `FlatList` for large or unbounded data. Dots are pressable and jump to their slide. A fractional `itemWidth` (default `0.85`) measures the viewport until the first layout, so pass absolute pixels (`> 1`) when the parent is narrower than the window and the first frame matters.
