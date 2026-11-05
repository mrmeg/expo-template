---
components: [DismissKeyboard]
use-for: "Tap-away keyboard dismissal"
instead-of: "Screen-level keyboard handling"
---

# DismissKeyboard

`DismissKeyboard` owns tap dismissal; its ScrollView uses
`keyboardShouldPersistTaps="always"` so RN cannot independently blur a hosted
field after a non-scrolling drag. Use `always` for your own scroll view inside
that boundary too. Dead-space taps dismiss on release; movement and multitouch
cancel. Actual scrolling retains platform-specific dismissal. Submit handlers
call `dismissKeyboard()` explicitly.
