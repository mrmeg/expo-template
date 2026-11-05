---
components: [Label]
use-for: "Accessible form labels"
instead-of: "Plain styled text labels"
---

# Label

- Pair a standalone `Label` with its control using two DISTINCT ids: `nativeID` is the label's own id, `htmlFor` is the input's id (`<Label nativeID="email-label" htmlFor="email-input">` + `<TextInput nativeID="email-input" />`). One id on both renders duplicate ids on web and associates nothing. Prefer `TextInput`'s own `label` prop when no separate label element is needed.
