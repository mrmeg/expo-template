# Spec: Dialog / Modal Component

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What

A new `Dialog` compound component at `client/components/ui/Dialog.tsx` following the shadcn/ui pattern. Built on `@rn-primitives/dialog` (available on npm as `@rn-primitives/dialog@1.4.0`, not yet installed). Includes an Alert Dialog variant using `@rn-primitives/alert-dialog` (also `@1.4.0`, not yet installed).

Sub-components:
- `Dialog` (root -- state management)
- `Dialog.Trigger` (opens the dialog)
- `Dialog.Content` (centered overlay with animated backdrop)
- `Dialog.Header` (title + description container)
- `Dialog.Footer` (action buttons container)
- `Dialog.Title` (heading text)
- `Dialog.Description` (body text)
- `Dialog.Close` (explicit close button / slot)

Plus an `AlertDialog` export using the same sub-component pattern but with non-dismissible behavior (no backdrop tap close, requires explicit action).

## Why

The codebase has BottomSheet (slides up from bottom) and Drawer (slides in from side) but no centered modal/dialog component. Centered dialogs are the standard pattern for:

- Confirmation prompts ("Are you sure you want to delete?")
- Alert messages requiring acknowledgment
- Form dialogs (e.g., rename, quick edit)
- Information modals

Without a Dialog, consumers must build ad-hoc modal overlays or misuse BottomSheet for centered content. A proper Dialog also provides the correct `role="dialog"` / `role="alertdialog"` semantics out of the box.

## Current State

### Existing overlay components

**BottomSheet** (`client/components/ui/BottomSheet.tsx`):
- Uses RN core `Animated` API (not Reanimated) for `translateY` and `backdropOpacity`.
- Renders via `@rn-primitives/portal` Portal component.
- Uses `FullWindowOverlay` from `react-native-screens` on iOS for proper z-index.
- Compound component pattern: `BottomSheet.Trigger`, `.Content`, `.Handle`, `.Header`, `.Body`, `.Footer`, `.Close`.
- Supports controlled (`open` / `onOpenChange`) and uncontrolled (`defaultOpen`) modes via `useReducer`.
- Backdrop press closes by default (`closeOnBackdropPress` prop).
- Re-provides context inside Portal since Portal breaks the React context tree.
- Wraps children in `TextColorContext.Provider` and `TextClassContext.Provider`.

**Drawer** (`client/components/ui/Drawer.tsx`):
- Nearly identical architecture to BottomSheet (RN core `Animated`, Portal, FullWindowOverlay, compound pattern).
- Same controlled/uncontrolled state pattern.
- Same context re-provision inside Portal.

**Popover** (`client/components/ui/Popover.tsx`):
- Thin wrapper around `@rn-primitives/popover`.
- Uses `AnimatedView` (Reanimated-based) with `type="fade"` for entrance animation.
- Uses `Portal` with `FullWindowOverlay`.
- Sets text color context on content.

**Tooltip** (`client/components/ui/Tooltip.tsx`):
- Same approach as Popover, wrapping `@rn-primitives/tooltip`.
- Uses `AnimatedView` with `type="fade"` for entrance.

### @rn-primitives/dialog (to install)

`@rn-primitives/dialog@1.4.0` is available on npm. It provides headless primitives: `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Close`. The primitive handles:
- Open/close state management
- Portal rendering
- Basic accessibility attributes (`role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`)
- Trigger press handling
- Close on overlay press (configurable)

### @rn-primitives/alert-dialog (to install)

`@rn-primitives/alert-dialog@1.4.0` provides the same primitives but with `role="alertdialog"` semantics and no dismiss-on-overlay-press by default. It adds `Action` and `Cancel` sub-components.

### Design tokens available

- `spacing.radiusMd` (6) for border radius
- `spacing.radiusLg` (8) for card-level radius
- `theme.colors.overlay` for backdrop color
- `theme.colors.background`, `theme.colors.card`, `theme.colors.border` for content styling
- `theme.colors.foreground`, `theme.colors.text`, `theme.colors.textDim` for text
- `getShadowStyle("soft")` for subtle shadow
- `AnimatedView` with `type="fade"` or `type="scale"` for entrance animation
- `useStaggeredEntrance` with `type="scale"` for scale-in effect

## Changes

### 1. Install dependencies

```bash
bun add @rn-primitives/dialog @rn-primitives/alert-dialog
```

### 2. Create `client/components/ui/Dialog.tsx`

The component wraps `@rn-primitives/dialog` with project styling and animation, following the same patterns as Popover and Tooltip (which also wrap `@rn-primitives/*` primitives).

#### Dialog Root

```tsx
import * as DialogPrimitive from "@rn-primitives/dialog";

interface DialogProps extends DialogPrimitive.RootProps {
  children: React.ReactNode;
}

function DialogRoot({ children, ...props }: DialogProps) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
}
```

Supports controlled (`open` / `onOpenChange`) and uncontrolled modes, delegated to the primitive.

#### Dialog Trigger

```tsx
const DialogTrigger = DialogPrimitive.Trigger;
```

Direct re-export of the primitive trigger. Supports `asChild` for slot composition.

#### Dialog Content

```tsx
interface DialogContentProps extends DialogPrimitive.ContentProps {
  portalHost?: string;
}

function DialogContent({
  portalHost,
  style,
  children,
  ...props
}: DialogContentProps) {
  const { theme, getShadowStyle, getContrastingColor } = useTheme();
  const textColor = getContrastingColor(
    theme.colors.background,
    palette.white,
    palette.black,
  );

  return (
    <DialogPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <DialogPrimitive.Overlay
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.overlay },
            Platform.OS === "web" && { zIndex: 50 },
          ]}
        >
          <AnimatedView type="fade" enterDuration={200}>
            <View style={overlayStyles.centeredContainer}>
              <AnimatedView type="scale" enterDuration={250}>
                <TextColorContext.Provider value={textColor}>
                  <TextClassContext.Provider value="">
                    <DialogPrimitive.Content
                      style={StyleSheet.flatten([
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          borderWidth: 1,
                          borderRadius: spacing.radiusLg,
                          padding: spacing.lg,
                          width: "90%",
                          maxWidth: 450,
                          ...getShadowStyle("soft"),
                        },
                        style,
                      ])}
                      {...props}
                    >
                      {children}
                    </DialogPrimitive.Content>
                  </TextClassContext.Provider>
                </TextColorContext.Provider>
              </AnimatedView>
            </View>
          </AnimatedView>
        </DialogPrimitive.Overlay>
      </FullWindowOverlay>
    </DialogPrimitive.Portal>
  );
}
```

Key decisions:
- **Centered layout**: The overlay uses `justifyContent: "center"` and `alignItems: "center"` to center the content.
- **Two nested AnimatedView layers**: The outer fades the backdrop. The inner scales the content panel from 0.95 to 1.0 (the `AnimatedView type="scale"` uses `useStaggeredEntrance` which respects `useReducedMotion`).
- **Max width**: 450px prevents the dialog from stretching too wide on large screens. 90% width ensures it fits on small screens with margin.
- **`StyleSheet.flatten`**: Required to avoid style array crashes on web per CLAUDE.md.
- **FullWindowOverlay**: iOS needs `react-native-screens` overlay for proper z-index, same as BottomSheet/Drawer/Popover.

#### Dialog Header

```tsx
function DialogHeader({ children, style, ...props }: ViewProps & { children: React.ReactNode }) {
  return (
    <View
      style={[
        { gap: spacing.xs, marginBottom: spacing.md },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
```

#### Dialog Footer

```tsx
function DialogFooter({ children, style, ...props }: ViewProps & { children: React.ReactNode }) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: spacing.sm,
          marginTop: spacing.lg,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
```

#### Dialog Title

```tsx
function DialogTitle({
  children,
  style,
  ...props
}: DialogPrimitive.TitleProps & { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <DialogPrimitive.Title asChild>
      <StyledText
        fontWeight="semibold"
        style={StyleSheet.flatten([
          {
            fontSize: 18,
            lineHeight: 24,
            letterSpacing: -0.3,
            color: theme.colors.text,
          },
          style,
        ])}
        {...props}
      >
        {children}
      </StyledText>
    </DialogPrimitive.Title>
  );
}
```

Uses `asChild` to pass the title role from the primitive onto `StyledText`. Typography matches `CardTitle` (18px, -0.3 letterSpacing, semibold).

#### Dialog Description

```tsx
function DialogDescription({
  children,
  style,
  ...props
}: DialogPrimitive.DescriptionProps & { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <DialogPrimitive.Description asChild>
      <StyledText
        style={StyleSheet.flatten([
          {
            fontSize: 14,
            lineHeight: 20,
            color: theme.colors.textDim,
          },
          style,
        ])}
        {...props}
      >
        {children}
      </StyledText>
    </DialogPrimitive.Description>
  );
}
```

#### Dialog Close

```tsx
const DialogClose = DialogPrimitive.Close;
```

Direct re-export. Supports `asChild`.

#### Compound Export

```tsx
const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
```

### 3. Alert Dialog variant

Same file or a separate `AlertDialog.tsx` -- implementer's choice based on file size. The Alert Dialog wraps `@rn-primitives/alert-dialog` and adds two extra sub-components:

```tsx
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";

// AlertDialog.Content: same styling as Dialog.Content but the overlay
// does NOT close on press (the primitive handles this automatically).

// AlertDialog.Action: wraps AlertDialogPrimitive.Action
const AlertDialogAction = AlertDialogPrimitive.Action;

// AlertDialog.Cancel: wraps AlertDialogPrimitive.Cancel
const AlertDialogCancel = AlertDialogPrimitive.Cancel;
```

The `AlertDialogContent` component is identical to `DialogContent` except:
- It uses `AlertDialogPrimitive.Portal`, `AlertDialogPrimitive.Overlay`, and `AlertDialogPrimitive.Content`.
- The overlay does not dismiss on tap (inherent to the alert-dialog primitive).
- Uses `role="alertdialog"` (the primitive sets this automatically).

### 4. Add to barrel export

Add Dialog and AlertDialog exports to `client/components/ui/index.ts` (if a barrel exists) or ensure they are importable via `@/client/components/ui/Dialog`.

### 5. Showcase screen

Add a Dialog showcase section to the existing component showcase (or create `app/(main)/showcase/dialog.tsx` if showcase uses file-based routing). Demonstrate:
- Basic dialog with title, description, and close button
- Dialog with form content (TextInput inside)
- Alert dialog requiring confirmation
- Dialog triggered by a Button

## Acceptance Criteria

1. **Dialog renders centered**: `Dialog.Content` appears centered on screen with a semi-transparent backdrop on iOS, Android, and web.
2. **Backdrop fade animation**: Opening the dialog fades the backdrop from transparent to `theme.colors.overlay`. Closing fades it back. Animation duration ~200ms.
3. **Content scale-in animation**: The dialog content panel scales from 0.95 to 1.0 with a spring feel on open. On close, it fades out (no scale-down needed).
4. **Reduced motion respected**: When reduced motion is enabled, the dialog appears and disappears instantly with no animation. The `AnimatedView` / `useStaggeredEntrance` hooks already handle this.
5. **Accessible on web**: The content element has `role="dialog"` and `aria-modal="true"` in the DOM. `aria-labelledby` points to the Title. `aria-describedby` points to the Description.
6. **Accessible on native**: `accessibilityViewIsModal` is set on the content, trapping VoiceOver/TalkBack focus inside the dialog.
7. **Dismissible**: Tapping the backdrop closes the Dialog. Pressing the `Dialog.Close` button closes it. Pressing Escape on web closes it (if the primitive supports it).
8. **Alert Dialog non-dismissible**: `AlertDialog` does not close on backdrop tap. Only `AlertDialog.Action` or `AlertDialog.Cancel` close it.
9. **Controlled and uncontrolled**: `<Dialog>` works without `open`/`onOpenChange` props (uncontrolled). Also works with them (controlled).
10. **Style override**: `Dialog.Content` accepts a `style` prop that merges with defaults using `StyleSheet.flatten`.
11. **Text color context**: Text inside the dialog inherits the correct color via `TextColorContext` (same pattern as Popover/Tooltip).
12. **No style array crashes on web**: All style merging uses `StyleSheet.flatten` per CLAUDE.md rules.
13. **Compound component API**: Consumer can use `Dialog.Trigger`, `Dialog.Content`, etc. via dot notation. Named exports also available for tree-shaking.

## Constraints

- Must install `@rn-primitives/dialog` and `@rn-primitives/alert-dialog` (both `^1.4.0`). No other new dependencies.
- Follow existing patterns: compound component export (`Object.assign`), `FullWindowOverlay` on iOS, `Portal` for rendering, `TextColorContext`/`TextClassContext` providers on content.
- Use `AnimatedView` for animations (do not introduce raw Reanimated code in the component -- delegate to existing hooks).
- Use `StyleSheet.flatten` for all style merging that touches primitive components.
- Match existing design tokens: `spacing.radiusLg` for border radius, `theme.colors.overlay` for backdrop, `getShadowStyle("soft")` for shadow.
- Typography for Title should match `CardTitle` (18px, semibold, -0.3 letterSpacing).
- Typography for Description should match `CardDescription` (14px, textDim color).
- All code must use double quotes, semicolons, 2-space indentation.

## Out of Scope

- Nested dialogs (dialog opening another dialog). Supported if the primitive handles it, but not explicitly designed for or tested.
- Drawer-to-dialog responsive pattern (showing a BottomSheet on mobile and Dialog on desktop). This is a layout concern for a separate spec.
- Form validation inside Dialog. The Dialog is a container; form logic lives in the consumer.
- Custom animations (e.g., slide-in from top). The scale-in + fade pattern is the single supported animation.
- Keyboard focus trapping (Tab key cycling). Rely on what the `@rn-primitives/dialog` primitive provides out of the box.

## Files Likely Affected

- `client/components/ui/Dialog.tsx` -- **new file** (primary deliverable)
- `package.json` -- add `@rn-primitives/dialog` and `@rn-primitives/alert-dialog` dependencies
- `bun.lock` -- updated by `bun add`
- `app/(main)/showcase/dialog.tsx` -- **new file** (showcase screen, if showcase uses file-based routing)
- `client/components/ui/index.ts` -- add Dialog/AlertDialog exports (if barrel file exists)

## Edge Cases

- **Dialog opened from BottomSheet**: If a Dialog is triggered from within a BottomSheet, both overlays should stack correctly. The Dialog should render above the BottomSheet since both use Portal with FullWindowOverlay. Verify z-index ordering on web (Dialog overlay should use `zIndex: 52` or higher if BottomSheet uses 50-51).
- **Dialog with long content**: If Dialog content exceeds screen height, the content should remain centered but allow internal scrolling. The consumer should wrap long content in a `ScrollView`. The Dialog itself should have `maxHeight: "85%"` to prevent overflow.
- **Dialog on small screens**: The 90% width + 450px maxWidth ensures the dialog fits on phones (320px wide) and does not stretch on tablets/desktop.
- **Rapid open/close**: If the user taps the trigger rapidly, the dialog should not get stuck in a half-animated state. The primitive handles state; `AnimatedView` handles animation.
- **Alert Dialog with only Cancel**: An AlertDialog with only a Cancel button (no Action) should still work. The Cancel button closes the dialog.
- **Dark mode**: All colors come from the theme, so dark mode should work automatically. Verify that the backdrop overlay is visible in both light and dark themes.
- **Web Escape key**: The `@rn-primitives/dialog` primitive should handle Escape key to close the dialog on web. Verify this works. For AlertDialog, Escape should NOT close it (the primitive should handle this distinction).
- **Android back button**: On Android, the hardware back button should close a dismissible Dialog but not an AlertDialog. This may need additional handling if the primitive does not cover it.
