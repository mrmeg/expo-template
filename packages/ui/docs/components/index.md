# @mrmeg/expo-ui Component Docs

<!-- GENERATED FILE - do not edit. Rebuild with `bun run docs:ui`. -->

One file per component family. Open only the files for the components you use;
the cross-cutting rules (imports, app setup, theme, screen layout) are in
[`LLM_USAGE.md`](../../LLM_USAGE.md).

- [Accordion](Accordion.md): Multi-section disclosure. Instead of: Custom FAQ/settings expanders.
- [Alert](Alert.md): Cross-platform imperative alerts. Instead of: `window.alert` or duplicated RN/web branching.
- [AnimatedView](AnimatedView.md): Entrance and visibility animation. Instead of: Hand-rolled one-off Animated wrappers.
- [AudioPlayer](AudioPlayer.md): Audio with themed controls.
- [Avatar](Avatar.md), `AvatarGroup`: Profile images with initials/icon fallback. Instead of: Circles with a nested `Image` plus initials `Text`.
- [Badge](Badge.md): Short status labels. Instead of: Custom pill `View` + `Text`.
- [BottomSheet](BottomSheet.md): Mobile-first modal sheets. Instead of: Custom absolute-position sheets.
- [Button](Button.md): Commands and CTAs. Instead of: Pressable plus custom text styling.
- [Card](Card.md): One item in a collection (feed entry, grid tile, carousel slide) or a single tappable object. Instead of: Hand-rolled bordered tiles; never a box around a section, form, or row group.
- [Carousel](Carousel.md): Horizontally snapping slide row with pressable dots. Instead of: Snap `ScrollView` plus manual offset math.
- [Checkbox](Checkbox.md): Boolean selection. Instead of: Custom checkmark controls.
- [Collapsible](Collapsible.md): One-off disclosure. Instead of: Local animated height wrappers.
- [Dialog](Dialog.md), `AlertDialog`: Modal decisions and custom modal content. Instead of: Custom modal overlays.
- [DismissKeyboard](DismissKeyboard.md): Tap-away keyboard dismissal. Instead of: Screen-level keyboard handling.
- [Drawer](Drawer.md): Side panels and drawer navigation. Instead of: Custom sliding panels.
- [DropdownMenu](DropdownMenu.md): Menus and command lists. Instead of: Homemade popover menus.
- [EmptyState](EmptyState.md): No-data or recoverable error regions. Instead of: One-off empty placeholders.
- [ErrorBoundary](ErrorBoundary.md): React render error fallback. Instead of: Unhandled screen crashes.
- [Hydrated](Hydrated.md): Holding a Radix-backed subtree on a server-rendered web route until hydration, to avoid a `useId` mismatch. Instead of: Branching on `typeof window`.
- [Icon](Icon.md): Registered Lucide glyphs or custom art with theme tokens. Instead of: Raw vector icons with hardcoded colors.
- [IconButton](IconButton.md): Icon-only command; `accessibilityLabel` required; ≥44 pt hit area; adjacent `sm` IconButtons need a ≥16 pt gap (hit slop extends 8 pt). Instead of: `Button` with only an `Icon` child, or a raw `Pressable` + `Icon`.
- [Image](Image.md): Any picture.
- [InputOTP](InputOTP.md): Verification code entry. Instead of: Several manually managed text inputs.
- [Item](Item.md), `ItemGroup`: List / settings rows with density tokens; a pressable row takes `accessibilityLabel` / `Hint` / `accessibilityActions`, `testID`, `ref`; `ItemGroup`: A titled group of full-width `Item` rows with inset hairlines and an optional footer. Instead of: Hand-rolled row `View`s; `ItemGroup`: Bordered or shadowed boxes around rows, a `Card` per row, hand-drawn dividers.
- [KeyboardAvoidingView](KeyboardAvoidingView.md): Native keyboard-aware layout root. Instead of: Repeated app-local keyboard wrappers.
- [Label](Label.md): Accessible form labels. Instead of: Plain styled text labels.
- [MaxWidthContainer](MaxWidthContainer.md): Centered responsive width. Instead of: Per-screen max-width wrappers.
- [Media](Media.md), `MediaControlButton`, `MediaScrubber`: Icon control over video or images; seek bar.
- [MediaLibrary](MediaLibrary.md), `MediaTile`, `MediaGrid`, `MediaSelectionBar`, `UploadQueue`: One square tile of a media library; a grid of square tiles; select-all, count, Clear, Delete (N) over a grid; uploads in progress.
- [MediaViewer](MediaViewer.md): Full-screen lightbox over images and videos.
- [Notification](Notification.md): Global toast surface. Instead of: Screen-local toast state.
- [Popover](Popover.md): Anchored contextual content. Instead of: Custom anchored views.
- [Progress](Progress.md): Determinate or indeterminate progress. Instead of: Layout-shifting spinners.
- [RadioGroup](RadioGroup.md): Mutually exclusive choices. Instead of: Custom radio rows.
- [Screen](Screen.md): Page container with required safe-area `edges`, one horizontal inset, optional scroll. Instead of: Hand-rolled `useSafeAreaInsets` padding, `SafeAreaView` per screen.
- [SectionHeader](SectionHeader.md): Eyebrow / title / description section intro. Instead of: Stacked ad hoc heading text.
- [SegmentedControl](SegmentedControl.md): Native segmented picker (`@expo/ui`); `size="lg"` = 44 pt drawn control; a value not in `values` selects none. Instead of: Custom segmented views.
- [Select](Select.md): Option menus. Instead of: Custom dropdowns.
- [Separator](Separator.md): Horizontal or vertical dividers. Instead of: Border-only spacer views.
- [Skeleton](Skeleton.md), `SkeletonText`, `SkeletonAvatar`, `SkeletonCard`: Loading placeholders. Instead of: Blank space or generic spinners.
- [Slider](Slider.md): Numeric value selection (`@expo/ui`). Instead of: Custom pan gesture track.
- [StatCard](StatCard.md): Metric tile in a collection (a scrolling KPI rail) or one tappable metric. Instead of: Hand-rolled dashboard tiles.
- [StatusBar](StatusBar.md): Theme-aware native status bar. Instead of: Per-screen status-bar duplication.
- [StyledText](StyledText.md): Theme-aware typography. Instead of: Raw `Text` with hardcoded styles.
- [Switch](Switch.md): Binary settings. Instead of: Custom toggle switches.
- [Tabs](Tabs.md): In-page tabbed views. Instead of: Custom segmented/tab controls.
- [TextInput](TextInput.md): Text entry with label, helper/error text, clear, password reveal. Instead of: Raw `TextInput` plus repeated label/error code.
- [ThemeSelector](ThemeSelector.md): System / Light / Dark switch wired to the theme store; icon-only fits an `ItemActions` slot, `showLabels` stretches. Instead of: Three radio rows or a hand-rolled theme picker.
- [Toggle](Toggle.md), `ToggleIcon`: Pressed/unpressed control; an `iconOnly` toggle needs `accessibilityLabel` (dev warns once). Instead of: Button with local selected styling.
- [ToggleGroup](ToggleGroup.md): Single or multi toggle groups. Instead of: Custom segmented controls.
- [Tooltip](Tooltip.md): Short hover/focus help. Instead of: Persistent helper text or custom hover cards.
- [Video](Video.md): Inline video.
