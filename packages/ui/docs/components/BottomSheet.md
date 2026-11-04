---
components: [BottomSheet, BottomSheetTrigger, BottomSheetContent, BottomSheetHandle, BottomSheetHeader, BottomSheetBody, BottomSheetFooter, BottomSheetClose]
use-for: "Mobile-first modal sheets"
instead-of: "Custom absolute-position sheets"
---

# BottomSheet

`BottomSheet` renders the platform's native sheet through `@expo/ui` (iOS
SwiftUI `.sheet()`, Android Material3 `ModalBottomSheet`, web `vaul`). The
platform owns gestures and keyboard avoidance: `swipeEnabled`, `avoidKeyboard`,
and `dismissKeyboardOnDrag` are accepted for call-site ergonomics but have no
effect. On iOS the sheet presentation lifts or shrinks the hosted content so
`Footer` and the tail of `Body` end at the keyboard's top (device-verified);
on Android Material3 shrinks the sheet and `@expo/ui`'s `RNHostView` re-reports
its size to the shadow tree, which needs the app built against
`expo-modules-core` >= 57.0.4 (expo/expo#47778) — below that the column keeps
its detent height and `Footer` sits under the keyboard; the sheet warns once in
dev on Android, and the fix is `npx expo install --fix` plus a rebuild, never
padding in app code. Do not nest a `KeyboardAvoidingView` inside a
sheet. `BottomSheet.Content` mounts the tap-away keyboard-dismiss boundary on
its column, and `BottomSheet.Body` sets `keyboardShouldPersistTaps="always"` on
its ScrollView so that boundary owns dismissal; do not pass `never`. Sheet
content stays in the screen's React tree although it is drawn in another
window, so a ScrollView *around* a `BottomSheet` on the default
`keyboardShouldPersistTaps="never"` claims the first tap on any sheet control
(`Footer` included) while a sheet field is focused and blurs the field instead:
give scroll views that contain a sheet `keyboardShouldPersistTaps="always"` (or
`"handled"`), or use `DismissKeyboard`; the sheet warns once in dev on Android
when it sees such a tap. `Slider` and `SegmentedControl` are also
`@expo/ui`-backed.

`BottomSheet` `onDismissed` fires once per close after the sheet is fully gone
on every platform (iOS: `@expo/ui`'s native SwiftUI `onDismiss` event, after
the transition; Android: `@expo/ui`'s post-animation close callback; web: the
HTML `<dialog>` `close` event at the end of the exit animation). Open the next
modal — a `Dialog`, a native stack modal — from `onDismissed`, never from
`onOpenChange(false)` or a timer: on iOS the sheet is still dismissing when
`onOpenChange` fires and a `Modal` presented then is rejected.

`BottomSheet.Content` themes the native sheet surface with the card color. Pass
`backgroundStyle={{ backgroundColor: "transparent" }}`, plus a `style` clearing
the content column's card fill, when custom chrome such as a glass backdrop must
show through.
