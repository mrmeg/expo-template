---
components: [StyledText, SerifText, SansSerifText, MonoText, SerifBoldText, SansSerifBoldText, DisplayText, TitleText, HeadingText, SubheadingText, BodyText, CaptionText, LabelText, EyebrowText]
use-for: "Theme-aware typography"
instead-of: "Raw `Text` with hardcoded styles"
---

# StyledText

`StyledText` props: `semantic` (`title`, `heading`, `subheading`, `body`,
`caption`, `label`, `eyebrow`), `size` (`xs`, `sm`, `base`, `body`, `lg`, `xl`,
`xxl`, `display`), `fontWeight` (`light`–`bold`), `variant` (`sansSerif`,
`serif`, `mono`), `align`, `text`, `tx`, `txOptions`, `selectable` (default
`true` on iOS and web, `false` on Android since 0.27.0). Aliases: `DisplayText`, `TitleText`, `HeadingText`, `SubheadingText`,
`BodyText`, `CaptionText`, `LabelText`, `EyebrowText`, `MonoText`, `SerifText`,
`SansSerifText`, `SerifBoldText`, `SansSerifBoldText`.

Set `selectable={false}` on text labels inside app-owned `Pressable`s on every
platform (control chrome shows no selection cursor). On Android `StyledText` is
non-selectable by default because a selectable `Text` takes input focus and hides
the keyboard; pass `selectable` to opt copyable content in. Package controls
already scope label selectability; ordinary iOS/web text stays selectable.

Prefer semantic aliases over raw `Text`.

The sans face is Geist (Inter is the opt-in `sans: "inter"` preset). `eyebrow`
is 13 medium, sentence case, untracked; the `eyebrow` treatment
(`useThemeStore.getState().setTreatments({ eyebrow: "uppercase" })`) switches it to 12 semibold uppercase.
Geist has no italic, so `italic` on the default sans is synthesized.
