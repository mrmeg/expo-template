# Spec: New Component Showcases

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What

Add showcase demos for the 7 new UI components that currently have zero demo coverage: Dialog, Tabs, Select, RadioGroup, Progress, Slider, and InputOTP. Each section should demonstrate variants, sizes, states (error, disabled), and interactive examples. Update the Explore tab component count badge from "27 components" to the correct count.

## Why

The showcase screen is the primary way template users discover and evaluate components. Seven components were added to `client/components/ui/` but never wired into the showcase. Developers browsing the component library have no way to see these components in action, which means they may not know the components exist or how to use them. The stale "27 components" badge on the Explore tab is also misleading.

## Current State

- The showcase screen at `app/(main)/(demos)/showcase/index.tsx` demonstrates 20 existing components (Button, TextInput, Switch, Checkbox, Toggle, ToggleGroup, Accordion, Popover, DropdownMenu, Collapsible, Drawer, Alert, Tooltip, Separator, Badge, Card, Notification, EmptyState, Skeleton, BottomSheet).
- Seven components in `client/components/ui/` have no showcase sections: `Dialog.tsx`, `Tabs.tsx`, `Select.tsx`, `RadioGroup.tsx`, `Progress.tsx`, `Slider.tsx`, `InputOTP.tsx`.
- The Explore tab (`app/(main)/(tabs)/index.tsx`) shows a `<Badge variant="outline">27 components</Badge>` that does not reflect the actual count of 34 UI components in the directory.
- Each existing showcase section uses the `<Section>` and `<SubSection>` helper components from `client/showcase/index.ts` and follows a consistent pattern: section title, sub-sections for each variant/state, inline state hooks for interactivity.

## Changes

### 1. Add Dialog showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` from `@/client/components/ui/Dialog`.

Add a `<Section title="Dialog">` with:
- **SubSection "Basic Dialog"** — Button triggers a Dialog with title, description, and a close button.
- **SubSection "Alert Dialog"** — Button triggers an AlertDialog with a destructive action (e.g., "Delete item?") showing Cancel and Delete buttons.
- **SubSection "Dialog with Form"** — Dialog containing a TextInput, demonstrating dialog + form composition.

Add state hooks: `const [dialogOpen, setDialogOpen] = useState(false)` (and similar for alert dialog).

### 2. Add Tabs showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/client/components/ui/Tabs`.

Add a `<Section title="Tabs">` with:
- **SubSection "Underline Variant"** — Default underline tabs with 3 tab panels (e.g., Account, Password, Notifications), each showing placeholder content.
- **SubSection "Pill Variant"** — Pill-style tabs with `variant="pill"`.
- **SubSection "Small Size"** — Tabs with `size="sm"` to show the compact variant.
- **SubSection "With Icons"** — Tabs where each trigger has an icon (using the `icon` prop on TabsTrigger if available, or composing Icon + text).

Add state hooks for active tab values as needed.

### 3. Add Select showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` from `@/client/components/ui/Select`.

Add a `<Section title="Select">` with:
- **SubSection "Basic Select"** — A Select with 4-5 fruit options.
- **SubSection "Grouped Select"** — A Select with grouped items using SelectGroup and SelectLabel (e.g., grouped by category: Fruits, Vegetables).
- **SubSection "Sizes"** — Show sm, md, and lg size variants side by side.
- **SubSection "Disabled"** — A disabled Select.

Add state hooks for selected values.

### 4. Add RadioGroup showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `RadioGroup`, `RadioGroupItem` from `@/client/components/ui/RadioGroup`.

Add a `<Section title="Radio Group">` with:
- **SubSection "Basic"** — A RadioGroup with 3 options (e.g., Default, Comfortable, Compact).
- **SubSection "Sizes"** — Show sm, md, lg RadioGroup sizes.
- **SubSection "With Descriptions"** — Radio items each with a label and description below.
- **SubSection "Error State"** — A RadioGroup with `error={true}` showing error styling.
- **SubSection "Disabled"** — A disabled RadioGroup.

Add state hooks for selected radio values.

### 5. Add Progress showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `Progress` from `@/client/components/ui/Progress`.

Add a `<Section title="Progress">` with:
- **SubSection "Determinate"** — Progress bar at various fixed values (25%, 50%, 75%).
- **SubSection "Animated"** — A button that starts an animated progress from 0 to 100 using a timer/interval.
- **SubSection "Variants"** — Show `default`, `accent`, and `destructive` variants side by side.
- **SubSection "Sizes"** — Show sm, md, lg sizes stacked.
- **SubSection "Indeterminate"** — Progress with no `value` prop (indeterminate animation).

Add state hooks for animated progress value and a `useEffect`/timer for the animation demo.

### 6. Add Slider showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `Slider` from `@/client/components/ui/Slider`.

Add a `<Section title="Slider">` with:
- **SubSection "Basic"** — A Slider with default 0-100 range.
- **SubSection "With Value Label"** — Slider with `showValue={true}`.
- **SubSection "Custom Range"** — Slider with `min={0}` `max={10}` `step={1}`.
- **SubSection "Sizes"** — Show sm and md sizes.
- **SubSection "Disabled"** — A disabled Slider.

Add state hooks for slider values.

### 7. Add InputOTP showcase section

**File:** `app/(main)/(demos)/showcase/index.tsx`

Add imports for `InputOTP` from `@/client/components/ui/InputOTP`.

Add a `<Section title="Input OTP">` with:
- **SubSection "6-Digit Code"** — Default InputOTP with `length={6}`.
- **SubSection "4-Digit Code"** — InputOTP with `length={4}`.
- **SubSection "With Separator"** — InputOTP with a separator between groups (e.g., 3 + 3 digits with a dash separator if supported).
- **SubSection "Error State"** — InputOTP with `error={true}`.
- **SubSection "Disabled"** — A disabled InputOTP.

Add state hooks for OTP values.

### 8. Update component count badge

**File:** `app/(main)/(tabs)/index.tsx`

Change the Badge text from `27 components` to the correct count. Count every `.tsx` file in `client/components/ui/` (currently 34 files). The badge should read `34 components`.

## Acceptance Criteria

1. All 7 new components (Dialog, Tabs, Select, RadioGroup, Progress, Slider, InputOTP) have dedicated showcase sections with interactive demos.
2. Each section demonstrates at least: basic usage, size variants (where applicable), disabled state, and one interactive example.
3. The Explore tab badge shows the correct component count (34).
4. The showcase screen scrolls smoothly with the additional sections -- no performance regressions.
5. All showcase sections follow the existing `<Section>` / `<SubSection>` pattern used by the other 20 component demos.
6. TypeScript compiles with no new errors.
7. Web and native both render the new sections correctly. Dialog/Select/Popover overlays work on both platforms.
8. `StyleSheet.flatten()` is used for any @rn-primitives components that receive computed styles (per the style array crash prevention rule in CLAUDE.md).

## Constraints

- Add sections to the existing `app/(main)/(demos)/showcase/index.tsx` file. Do not create separate showcase pages per component.
- Follow the established pattern: `<Section title="...">` wrapping `<SubSection label="...">` blocks.
- Use realistic demo data (not "Lorem ipsum"). E.g., Select options should be plausible choices like "United States", "Canada", etc.
- All state for demos should be local `useState` hooks at the top of the `ShowcaseScreen` component, following the existing pattern.
- Respect the `StyleSheet.flatten()` rule for any @rn-primitives components.

## Out of Scope

- Extracting the showcase into separate per-component pages (that is a separate refactor).
- Adding tests for the showcase screen itself (it is a demo page, not production UI).
- Modifying the 7 component implementations -- this spec only adds demos for them.
- Adding new screen template demos (covered by a separate spec).

## Files Likely Affected

**Client:**
- `app/(main)/(demos)/showcase/index.tsx` (add 7 new showcase sections with imports and state)
- `app/(main)/(tabs)/index.tsx` (update badge count from "27 components" to "34 components")

## Edge Cases

- **Dialog on web:** Dialog overlay must work on React Native Web. Use `FullWindowOverlay` pattern already in the Dialog component. Test that opening/closing dialogs does not leave orphaned overlays.
- **Select dropdown positioning:** On small screens, the Select dropdown content may overflow. The Select component already handles safe area insets -- verify it works in the showcase context.
- **Slider gesture handling:** Slider uses `react-native-gesture-handler`. Ensure it works within the `KeyboardAwareScrollView` used by the showcase (gesture conflicts are possible). If scrolling conflicts occur, wrapping the Slider subsection in a fixed-height container may help.
- **InputOTP focus management:** Tapping an OTP cell should focus the hidden input. Verify this works on both web and native within the scroll view.
- **Large file size:** The showcase file is already large (~500 lines). Adding 7 sections will increase it significantly. Keep each section concise -- demonstrate the key variants without excessive repetition.

## Risks

- **Showcase scroll performance:** Adding 7 sections with interactive components increases the initial render cost. The existing `KeyboardAwareScrollView` should handle this, but if performance degrades on low-end devices, consider lazy rendering (outside this spec's scope).
- **Platform-specific component behavior:** Dialog, Select, and BottomSheet use portal-based overlays that behave differently on iOS, Android, and web. Test all three platforms if possible.
