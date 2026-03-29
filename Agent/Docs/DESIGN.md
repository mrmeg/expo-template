# UI/UX Guide

> Design system, component conventions, patterns, and tokens.

---

## Design Philosophy

Shadcn-inspired, zinc-based palette. Minimal, border-driven aesthetic — cards use borders, not shadows. Subtle interactions (scale press, haptics). WCAG contrast compliance via computed text colors.

## Color System

### Palette

**Brand/Accent — Teal:**
- Light mode: `#14b8a6` (teal-500)
- Dark mode: `#2dd4bf` (teal-400)

**Neutrals — Zinc scale:**
- White `#FFFFFF` through gray-950 `#09090B` (light mode surfaces)
- Dark-900 `#18181B` through dark-100 `#F4F4F5` (dark mode surfaces)

**Status Colors:**
- Success: `#22C55E` (green-500)
- Warning: `#F59E0B` (amber-500)
- Destructive: `#EF4444` (red-500)

### Semantic Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | white | dark-900 | Page background |
| `foreground` | gray-950 | dark-100 | Primary text |
| `primary` | gray-900 | gray-50 | Buttons, interactive fills |
| `primaryForeground` | white | gray-900 | Text on primary |
| `accent` | teal-500 | teal-400 | Highlights, active tabs, badges |
| `accentForeground` | white | dark-900 | Text on accent |
| `card` | gray-50 | dark-800 | Card backgrounds |
| `border` | gray-200 | dark-700 | Borders, dividers |
| `muted` | gray-100 | dark-700 | Muted backgrounds |
| `mutedForeground` | gray-500 | dark-400 | Secondary text |
| `destructive` | red-500 | red-500 | Error states |
| `secondary` | gray-100 | dark-800 | Secondary surfaces |

**Key Rule:** Primary = neutral (NOT teal). Accent = teal.

## Typography

### Scale

| Name | Size | Line Height | Letter Spacing | Use For |
|------|------|-------------|----------------|---------|
| xs | 12px | 16px | — | Fine print, badges |
| sm | 14px | 20px | 0.5 | Labels, captions |
| base | 16px | 24px | — | Body text |
| lg | 18px | 28px | — | Subheadings |
| xl | 20px | 28px | — | Headings |
| 2xl | 24px | 32px | -0.3 | Section titles |
| 3xl | 30px | 36px | — | Page titles |
| 4xl | 36px | 40px | -0.5 | Display text |

### Font Families
- **Sans-serif:** Lato_400Regular, Lato_700Bold
- **Serif:** Georgia (fallback)
- **Font weight convention:** Use weight "500" for medium emphasis (buttons, labels) — not the bold font family

### Semantic Text Components
- `<TitleText>` — xxl (28px), semibold
- `<HeadingText>` — xl (22px), semibold
- `<SubheadingText>` — lg (18px), medium
- `<BodyText>` — body (15px), regular
- `<CaptionText>` — sm (12px), regular
- `<LabelText>` — base (14px), medium
- `<DisplayText>` — display (34px), serif

## Spacing

### Scale
| Token | Value | Common Use |
|-------|-------|------------|
| xxs | 2px | Hairline gaps |
| xs | 4px | Tight padding |
| sm | 8px | Item spacing, small gaps |
| md | 16px | Standard padding, gutter |
| lg | 24px | Section gaps, card padding |
| xl | 32px | Section spacing |
| xxl | 48px | Large gaps |
| xxxl | 64px | Page-level spacing |

### Semantic Spacing
- `buttonPadding`: 10px
- `inputPadding`: 10px
- `cardPadding`: 16px
- `screenPadding`: 16px
- `sectionSpacing`: 32px
- `listItemSpacing`: 8px

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| radiusXs | 2px | Tiny elements |
| radiusSm | 4px | Badges, chips |
| radiusMd | 6px | **Default** (buttons, inputs) |
| radiusLg | 8px | Cards |
| radiusXl | 12px | Large cards |
| radius2xl | 16px | Modals |
| radiusFull | 9999px | Pills, avatars |

## Component Sizes

Consistent height system across interactive components:

| Size | Height | Usage |
|------|--------|-------|
| sm | 32px | Compact buttons, inputs |
| md | 36px | **Default** |
| lg | 40px | Prominent actions |

Buttons additionally have a `lg` at 44px with larger padding.

## Shadows

Subtle, not dramatic. **Cards have no shadow by default** — use border-only approach.

| Type | Offset | Opacity | Radius | Elevation |
|------|--------|---------|--------|-----------|
| subtle | (0,1) | 0.05 | 2 | 1 |
| base | (0,1) | 0.10 | 3 | 3 |
| soft | (0,4) | 0.10 | 6 | 4 |
| sharp | (0,1) | 0.15 | 1 | 2 |

**Web:** `getShadowStyle()` returns empty object. boxShadow causes RN Web crashes.

## Component Reference

### Button
- **Presets:** default (accent), outline, ghost, link, destructive, secondary
- **Sizes:** sm (32px), md (36px), lg (44px)
- **Features:** Scale press (0.97), loading spinner, left/right accessories, i18n support
- **Outline:** Uses `border` color (not primary) with `foreground` text
- **Link:** No press animation (scale 1)
- Automatic contrast text via `getContrastingColor()`

### TextInput
- **Variants:** outline, filled, underlined
- **Sizes:** sm (32px), md (36px), lg (40px)
- **Features:** Label, helper text, error state, password toggle, left/right elements, web focus ring
- Numeric validation, multiline via `rows` prop

### Card
- **Variants:** default (bg + border), outline (transparent + border), ghost (no border)
- **Radius:** radiusLg (8px)
- **Padding:** lg (24px)
- Pressable with scale animation (0.98) when `onPress` provided
- Compound: `<Card>`, `<CardHeader>`, `<CardContent>`, `<CardFooter>`, `<CardTitle>`, `<CardDescription>`

### Switch
- **Dimensions:** width 44, height 24, thumb 20
- **Track:** 1px border for contrast, animates color on toggle
- **Variants:** default (primary when checked), ios (#34C759 green)
- Light haptic on user toggle

### Toggle / ToggleGroup
- **Variants:** default (transparent → 10% primary alpha), outline (border → primary fill)
- Supports single/multiple selection
- Icon color inherits from TextColorContext

### Checkbox
- **Sizes:** sm (16px), md (20px), lg (24px)
- Fills with `primary` bg when checked, icon uses `primaryForeground`
- Animated checkmark fade (60ms)
- Error state: red border + text

### Badge
- **Variants:** default, secondary, outline, destructive
- Pill shape (radiusFull), fontSize 12, fontWeight 500

### Skeleton
- Pulsing shimmer animation
- Variants: `<Skeleton>`, `<SkeletonText>`, `<SkeletonAvatar>`, `<SkeletonCard>`
- Respects reduced motion

### EmptyState
- Centered layout with icon, title, description, action button
- Ideal for FlatList ListEmptyComponent

### Dialog / AlertDialog
- Centered modal overlay with backdrop fade + content scale-in
- Compound: `.Trigger`, `.Content`, `.Header`, `.Footer`, `.Title`, `.Description`, `.Close`
- AlertDialog: non-dismissible, requires `.Action` or `.Cancel`
- Max width 450, 85% max height, FullWindowOverlay on iOS

### Tabs
- **Variants:** underline (bottom border indicator), pill (filled background)
- **Sizes:** sm (32px), md (36px)
- Compound: `Tabs`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`
- Animated active indicator, keyboard navigation on web

### Select
- Form-style dropdown (distinct from DropdownMenu)
- **Sizes:** sm (32px), md (36px), lg (40px)
- Compound: `.Trigger`, `.Value`, `.Content`, `.Item`, `.Group`, `.Label`, `.Separator`
- Error/disabled states, check indicator on selected item

### RadioGroup
- **Sizes:** sm (16px), md (20px), lg (24px) — matches Checkbox
- Animated inner dot (60ms withTiming), haptic feedback
- Label tap activates radio, error/disabled states

### Progress
- **Sizes:** sm (4px), md (8px), lg (12px)
- **Variants:** default (primary), accent (teal), destructive
- Determinate (animated fill) and indeterminate (opacity pulse)

### Slider
- **Sizes:** sm (4px track/16px thumb), md (6px track/20px thumb)
- Gesture handler Pan, step snapping, haptic feedback
- Optional value label above thumb

### InputOTP
- Individual character boxes (36x40px), hidden TextInput capture
- Auto-advance, backspace navigation, paste support
- Error state, secure entry (bullet mask), auto-focus

## Animations

### useScalePress
- Default scale: 0.97 (cards use 0.98)
- Spring config: damping 20, stiffness 300
- Optional haptic feedback (light)
- Respects reduced motion

### useStaggeredEntrance
- Types: fade, fadeSlideUp, fadeSlideDown, scale
- STAGGER_DELAY: 30ms between items
- Duration: 200ms default
- Respects reduced motion

## Critical Rules

1. **Never use style arrays on @rn-primitives** — always `StyleSheet.flatten()`
2. **Cards: border-only** — no shadow by default
3. **Primary = neutral** — teal is `accent`, not primary
4. **Button weight: "500"** — not the bold font family
5. **Web shadows: empty object** — getShadowStyle returns `{}` on web
6. **TextColorContext** — Button and Toggle set text color for children via context
7. **Contrast compliance** — use `getContrastingColor()` for text on dynamic backgrounds (LRU cache, 500 entries)

## Tab Bar

- Active tint: `accent` (teal)
- Inactive tint: `mutedForeground`
- Background: `card`
- Label: 12px, fontWeight 500
- iOS: 85px height for safe area
