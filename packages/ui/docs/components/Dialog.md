---
components: [Dialog, AlertDialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel]
also: [AlertDialog]
use-for: "Modal decisions and custom modal content"
instead-of: "Custom modal overlays"
---

# Dialog

Requires root `UIProvider` portal host.

`Dialog` and `AlertDialog` present their content through React Native's `Modal`
on iOS, rendered inline where the dialog sits (transparent, `overFullScreen`,
unanimated; the package fade/scale run inside), so it stacks above whatever
screen, native stack modal or sheet contains it; `portalHost` is honored on
Android and web only. `@expo/ui`-hosted controls (`TextInput`, `Slider`,
`SegmentedControl`) need a view controller above them and render as empty,
unfocusable boxes inside react-native-screens' `FullWindowOverlay`, which
`Drawer`, `Popover`, `Select`, `DropdownMenu` and `Tooltip` still use on iOS —
keep hosted controls out of those, and do not place a `Dialog` inside their
content (no view controller to present from; render it at screen level and open
it from the item's `onPress`). The dialog owns keyboard avoidance on iOS and
Android (its content sits outside `UIProvider`'s root avoidance on both: the iOS
Modal and the Android portal host): the centered container is a package
`KeyboardAvoidingView` (`behavior="padding"`), the card recenters above the
keyboard with fields and footer visible, and `useKeyboardAvoidance()` is `true`
in dialog content; do not wrap dialog content in another `KeyboardAvoidingView`.
Web has no software keyboard and no avoidance owner. Dialog content owns tap-away
keyboard dismissal on iOS and Android (the same boundary as `DismissKeyboard`,
on the `Dialog` card itself and on the `AlertDialog` centered container:
dead-space taps hide the keyboard on release, a `Dialog` backdrop tap closes the
dialog and the keyboard with it, controls and fields fire on the first tap); do
not wrap dialog content in `DismissKeyboard` for that. Android and web render dialog content inline into
the portal host.
