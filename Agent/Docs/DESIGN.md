# Design System

<!-- Owned by: Designer persona -->

Source files: `client/constants/colors.ts`, `client/constants/fonts.ts`, `client/constants/spacing.ts`, `client/hooks/useTheme.ts`, `client/components/ui/`

## Design Philosophy

This design system follows a **shadcn/ui-inspired** aesthetic adapted for React Native. The guiding principles are:

- **Zinc palette neutrals** -- a cool gray scale (not warm stone/slate) for all neutral surfaces and text
- **Border-driven aesthetic** -- cards and containers use borders instead of shadows by default
- **WCAG contrast compliance** -- the `useTheme()` hook provides `getContrastingColor()`, `getContrastRatio()`, and `getTextColorForBackground()` utilities with a 500-entry LRU contrast cache
- **Minimal, confident UI** -- no gratuitous gradients, glows, or decorative flourishes on primary surfaces
- **Cross-platform consistency** -- identical tokens on iOS, Android, and web

## Color System

### Critical Rule

**Primary = neutral (NOT teal).** In light mode, `primary` is dark gray (`#18181B`). In dark mode, `primary` is near-white (`#FAFAFA`). This follows shadcn convention where primary buttons are dark/light neutral.

**Accent = teal.** Use `theme.colors.accent` for highlights, active tab indicators, badges, links, and brand emphasis. Light mode: `#14b8a6` (teal-500). Dark mode: `#2dd4bf` (teal-400, brighter for contrast).

### Raw Palette

```
Brand (teal):    #2dd4bf (400)  #14b8a6 (500)  #0d9488 (600)
Zinc neutrals:   #FAFAFA (50)   #F4F4F5 (100)  #E4E4E7 (200)  #D4D4D8 (300)
                 #A1A1AA (400)  #71717A (500)   #52525B (600)  #3F3F46 (700)
                 #27272A (800)  #18181B (900)   #09090B (950)
Status:          #22C55E / #4ADE80 (green)  #F59E0B / #FBBF24 (amber)  #EF4444 / #F87171 (red)
```

### Semantic Token Table

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#FFFFFF` | `#09090B` | Page background |
| `foreground` | `#09090B` (gray-950) | `#F4F4F5` (dark-100) | Primary text |
| `card` | `#FAFAFA` (gray-50) | `#18181B` (dark-800) | Card surfaces |
| `cardForeground` | `#09090B` (gray-950) | `#F4F4F5` (dark-100) | Text on cards |
| `text` | `#09090B` (gray-950) | `#F4F4F5` (dark-100) | Body text (alias of foreground) |
| `textDim` | `#71717A` (gray-500) | `#A1A1AA` (dark-400) | Secondary/caption text |
| `primary` | `#18181B` (gray-900) | `#FAFAFA` (gray-50) | Buttons, emphasis |
| `primaryForeground` | `#FAFAFA` (gray-50) | `#18181B` (gray-900) | Text on primary |
| `secondary` | `#14b8a6` (teal-500) | `#2dd4bf` (teal-400) | Secondary interactive |
| `secondaryForeground` | `#FFFFFF` | `#000000` | Text on secondary |
| `accent` | `#14b8a6` (teal-500) | `#2dd4bf` (teal-400) | Brand highlight color |
| `accentForeground` | `#FFFFFF` | `#18181B` (gray-900) | Text on accent |
| `muted` | `#F4F4F5` (gray-100) | `#27272A` (dark-700) | Muted backgrounds |
| `mutedForeground` | `#71717A` (gray-500) | `#A1A1AA` (dark-400) | Text on muted |
| `destructive` | `#EF4444` (red-500) | `#F87171` (red-400) | Error/danger |
| `destructiveForeground` | `#FFFFFF` | `#FFFFFF` | Text on destructive |
| `success` | `#22C55E` (green-500) | `#4ADE80` (green-400) | Success state |
| `warning` | `#F59E0B` (amber-500) | `#FBBF24` (amber-400) | Warning state |
| `border` | `#E4E4E7` (gray-200) | `#27272A` (dark-700) | Borders, dividers |
| `overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` | Modal overlay |

### Dark Mode

Theme preference is stored in `themeStore` (Zustand) and persisted to AsyncStorage (native) / localStorage (web). Options: `system | light | dark`. Access via `useTheme()` which returns `theme`, `scheme`, `toggleTheme()`, `setTheme()`.

## Typography

Source: `client/constants/fonts.ts`

### Font Families

- **Sans-serif:** `Lato_400Regular` (weight 400) and `Lato_700Bold` (weight 700)
- **Serif:** `Georgia` (iOS/web), `serif` (Android)
- **Text components:** `SansSerifText` (regular), `SansSerifBoldText` (bold) from `StyledText.tsx`

### Type Scale

| Size | fontSize | lineHeight | Letter Spacing |
|------|----------|------------|----------------|
| `xs` | 12 | 16 | -- |
| `sm` | 14 | 20 | -- |
| `base` | 16 | 24 | -- |
| `lg` | 18 | 28 | -- |
| `xl` | 20 | 28 | -- |
| `2xl` | 24 | 32 | -0.3 |
| `3xl` | 30 | 36 | -0.5 |
| `4xl` | 36 | 40 | -0.75 |

Sizes `2xl` and above use **negative letter spacing** for tighter display headings.

### Navigation Font Weights

| Style | Font | Weight |
|-------|------|--------|
| `regular` | Lato_400Regular | 400 |
| `medium` | Lato_400Regular | 500 |
| `bold` | Lato_700Bold | 600 |
| `heavy` | Lato_700Bold | 700 |

## Spacing

Source: `client/constants/spacing.ts` -- 8px base unit system.

### Spacing Scale

| Token | Value |
|-------|-------|
| `xxs` | 2px |
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |
| `xxxl` | 64px |

### Semantic Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `buttonPadding` | 10px | Default button internal padding |
| `inputPadding` | 10px | Default input internal padding |
| `cardPadding` | 16px | Default card content padding |
| `screenPadding` | 16px | Screen edge padding |
| `gutter` | 16px | Horizontal gutter between columns |
| `gutterVertical` | 24px | Vertical gutter between sections |
| `sectionSpacing` | 32px | Space between major page sections |
| `listItemSpacing` | 8px | Space between list items |

### `space()` helper

`space(n)` returns `n * 8` for quick multiples of the base unit.

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radiusNone` | 0 | No rounding |
| `radiusXs` | 2px | Minimal rounding |
| `radiusSm` | 4px | Small elements |
| `radiusMd` | 6px | **Default** (shadcn convention) |
| `radiusLg` | 8px | Cards, modals |
| `radiusXl` | 12px | Large containers |
| `radius2xl` | 16px | Extra large panels |
| `radiusFull` | 9999px | Circular/pill shapes |

### Icon Sizes

| Token | Value |
|-------|-------|
| `iconXs` | 12px |
| `iconSm` | 16px |
| `iconMd` | 24px |
| `iconLg` | 32px |
| `iconXl` | 48px |

## Component Sizes

Standard height presets shared across Button, TextInput, Toggle, and similar interactive components:

| Size | Height |
|------|--------|
| `sm` | 32px |
| `md` | 36px |
| `lg` | 40px (TextInput) / 44px (Button) |

## Shadows

Source: `useTheme().getShadowStyle(type)` -- returns native shadow styles.

| Type | Offset | Opacity | Radius | Elevation | Usage |
|------|--------|---------|--------|-----------|-------|
| `subtle` | 0, 1 | 0.05 | 2 | 1 | Light lift, default cards |
| `base` | 0, 1 | 0.1 | 3 | 3 | Standard elevated elements |
| `soft` | 0, 4 | 0.1 | 6 | 4 | Floating panels, popovers |
| `sharp` | 0, 1 | 0.15 | 1 | 2 | Crisp shadow, toolbars |

**Web: `getShadowStyle()` returns an empty object.** React Native Web's `boxShadow` handling causes crashes, so shadows are disabled on web entirely.

**Default card style: border-only, no shadow.** Only add shadow when explicit elevation is needed.

## Component Reference

All 35 components live in `client/components/ui/`.

### Interactive

| Component | Description |
|-----------|-------------|
| **Button** | Pressable with 6 presets (`default`, `outline`, `ghost`, `link`, `destructive`, `secondary`), 3 sizes (`sm`/`md`/`lg`), loading spinner, `useScalePress` animation, focus ring via `palette.teal500`. Font weight is `"500"` (not bold). Uses `TextColorContext` to propagate text color to children. |
| **TextInput** | Input with 3 variants (`outline`, `filled`, `underlined`), 3 sizes, clearable button, error state with icon, label support, numeric filtering. |
| **Switch** | Toggle switch with `default` and `ios` variants. Width 44, height 24, thumb 20. 1px border on track and thumb for contrast. Reanimated spring animation with haptic feedback. Respects `useReducedMotion()`. |
| **Toggle** | Button-like toggle using `@rn-primitives/toggle`. Reads text color from `TextColorContext`. |
| **ToggleGroup** | Multi-select toggle group. Reads text color from `TextColorContext`. |
| **Checkbox** | Themed checkbox. Fills with `primary` background when checked, icon uses `primaryForeground`. |
| **RadioGroup** | Grouped radio buttons with single selection. |
| **Slider** | Gesture-driven slider using `react-native-gesture-handler`. Sizes `sm` (track 4, thumb 16) and `md` (track 6, thumb 20). Haptic feedback on value changes. Optional value label display. |
| **InputOTP** | One-time password input with individual digit cells. |
| **Select** | Dropdown select using `@rn-primitives/select`. |

### Display

| Component | Description |
|-----------|-------------|
| **Card** | Context-based composition: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. Border-only by default, no shadow. |
| **Badge** | Inline label with variants: `default`, `secondary`, `outline`, `destructive`. |
| **Tabs** | Tab navigation with two variants: `underline` (line indicator) and `pill` (filled background). Sizes `sm`/`md`. Uses `TextColorContext`. |
| **Progress** | Progress bar with 3 variants (`default`, `accent`, `destructive`) and 3 sizes (`sm`=4px, `md`=8px, `lg`=12px). Supports indeterminate mode when `value` is omitted. |
| **Skeleton** | Loading placeholder with animated shimmer effect. |
| **EmptyState** | Centered layout with icon, title, description, and optional call-to-action button. |
| **Icon** | Wraps Feather icons (`@expo/vector-icons`) with theme integration. Accepts theme color names (`"primary"`, `"destructive"`, etc.) or hex strings. Supports custom `component` prop for non-Feather icons. `decorative` prop hides from accessibility tree. |
| **StyledText** | `SansSerifText` and `SansSerifBoldText` with i18n (`tx` prop), `TextColorContext` for inherited text color, and `TextClassContext` for style class propagation. |
| **Label** | Accessible form label component. |
| **Separator** | Horizontal or vertical divider line. |

### Overlays

| Component | Description |
|-----------|-------------|
| **Dialog** | Modal dialog with `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`. Uses `@rn-primitives/dialog`. |
| **Alert (AlertDialog)** | Native cross-platform alert. Wraps `Alert.alert` on native and provides web fallback. |
| **BottomSheet** | Native-style bottom sheet overlay. |
| **Drawer** | Side drawer with gesture support. Shared state via `drawerStore`. |
| **DropdownMenu** | Dropdown menu with items. Uses `@rn-primitives/dropdown-menu`. **Must use `StyleSheet.flatten()` on style arrays.** |
| **Popover** | Floating popover anchored to a trigger element. |
| **Tooltip** | Hover/press tooltip for supplementary information. |

### Layout and Navigation

| Component | Description |
|-----------|-------------|
| **Accordion** | Expandable/collapsible content sections with animated open/close. |
| **Collapsible** | Simple show/hide toggle wrapper. |
| **MaxWidthContainer** | Responsive width constraint for web. Breakpoints: sm (640), md (768), lg (1024), xl (1280), 2xl (1536). No-op on native. |
| **AnimatedView** | Convenience wrapper around `Animated.View` from Reanimated. |
| **DismissKeyboard** | Touchable wrapper that dismisses keyboard on tap outside inputs. |

### Feedback

| Component | Description |
|-----------|-------------|
| **Notification** | Toast-like notification triggered by `globalUIStore`. Types: `error`, `success`, `info`, `warning`. Supports position (`top`/`bottom`), duration, loading state. |
| **ErrorBoundary** | Catches render errors with retry button. Clear user-facing message, no technical jargon. |
| **StatusBar** | Cross-platform status bar configuration component. |

## Animations

Source: `client/hooks/useScalePress.ts`, `client/hooks/useStaggeredEntrance.ts`

### useScalePress

Press-feedback scale animation using Reanimated shared values.

| Option | Default | Description |
|--------|---------|-------------|
| `scaleTo` | 0.97 | Scale value when pressed |
| `haptic` | true | Fire haptic feedback on press |
| `damping` | 20 | Spring damping for bounce-back |
| `stiffness` | 300 | Spring stiffness |
| `disabled` | false | Skip animation when true |

Returns `{ animatedStyle, pressHandlers: { onPressIn, onPressOut }, scale }`.

Respects `useReducedMotion()` -- instantly applies transform when reduced motion is enabled.

### useStaggeredEntrance

Entrance animation with stagger support for lists and sequential reveals.

| Option | Default | Description |
|--------|---------|-------------|
| `type` | `"fadeSlideUp"` | Animation type: `fade`, `fadeSlideUp`, `fadeSlideDown`, `scale` |
| `delay` | 0 | Delay in ms (use `index * STAGGER_DELAY` for lists) |
| `duration` | 200 | Animation duration in ms |
| `slideDistance` | 8 | Slide distance in px (for slide types) |
| `initialScale` | 0.95 | Starting scale (for scale type) |

`STAGGER_DELAY` constant is exported as 30ms.

Respects `useReducedMotion()` -- content appears immediately when enabled.

### Haptics

`client/lib/haptics.ts` provides platform-aware haptic feedback: `hapticLight()`, `hapticMedium()`, `hapticSuccess()`. No-ops on web.

## Critical Rules

### StyleSheet.flatten for @rn-primitives

DropdownMenu items and similar `@rn-primitives` components **MUST** use `StyleSheet.flatten()` on style arrays. Nested style arrays crash React Native Web.

```tsx
// BAD -- crashes on web
<DropdownMenuItem style={[styles.item, { color: theme.primary }]} />

// GOOD
<DropdownMenuItem style={StyleSheet.flatten([styles.item, { color: theme.primary }])} />
```

### Border-only cards

Cards use border + background, **not shadow**, by default. Only add shadow via `getShadowStyle()` when explicit elevation is needed.

### Primary = neutral

Never use `primary` for teal/accent purposes. `primary` is always the neutral dark/light button color. Use `accent` or `secondary` for teal highlights.

### Button font weight

Button text uses `fontWeight: "500"` (medium), not bold. The font family is `Lato_400Regular` with weight override.

### Web shadows

`getShadowStyle()` returns `{}` on web. Do not attempt to use `boxShadow` in React Native Web styles.

### TextColorContext

`StyledText` components read inherited text color from `TextColorContext`. Button and other interactive components set this context so child text automatically receives the correct color. Always wrap text children in the appropriate context when building custom interactive components.

### useStyles hook

`useStyles(factory)` combines `useTheme()` with `StyleSheet.create()`. The factory receives `{ theme, spacing }` and returns style definitions. Returns `{ styles, theme, spacing, ...themeUtilities }`.
