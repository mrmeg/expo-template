# Spec: Form System & Form Screen Template

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## Summary

Add a form system built on `react-hook-form` and `zod` that integrates with the existing UI components (`TextInput`, `Checkbox`, `Switch`). This replaces the manual `useState` + validation boilerplate demonstrated in `app/(main)/(demos)/form-demo.tsx`. Also adds a new `FormScreen` template to `client/screens/` for multi-step form flows.

---

## Motivation

The current form demo (`app/(main)/(demos)/form-demo.tsx`) shows the pain clearly: 80+ lines of manual state management for 5 fields — separate `formData`, `errors`, `touched` objects, a per-field `validateField` switch statement, manual `handleBlur` wiring, and custom `updateField` callbacks. This pattern does not scale. Every new form screen would copy this boilerplate.

`react-hook-form` is the standard solution: uncontrolled inputs for performance, schema validation via resolvers, and a `Controller` component for controlled RN inputs. `zod` provides type-safe schema definitions that can be shared with API validation.

The project has no `Select` component yet (noted in CLAUDE.md as "once built"). The `FormSelect` adapter should be defined but can be implemented as a placeholder/stub that renders a basic picker until a proper `Select` UI component is built.

---

## Detailed Design

### Part A: Form Library Integration

#### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | `^7.x` (latest 7.x) | Form state management |
| `zod` | `^3.x` (latest 3.x) | Schema validation |
| `@hookform/resolvers` | `^3.x` (latest 3.x) | Connects zod schemas to RHF |

Install: `bun add react-hook-form zod @hookform/resolvers`

#### File Structure

```
client/lib/form/
  index.ts              (barrel export)
  FormProvider.tsx       (context wrapper)
  useFormField.ts        (hook to read field state from context)
  FormTextInput.tsx      (adapter for client/components/ui/TextInput)
  FormCheckbox.tsx       (adapter for client/components/ui/Checkbox)
  FormSwitch.tsx         (adapter for client/components/ui/Switch)
  FormSelect.tsx         (adapter stub for future Select component)
  FormMessage.tsx        (error message display component)
```

#### FormProvider (`client/lib/form/FormProvider.tsx`)

A thin wrapper around RHF's `FormProvider` that passes the form context down. This exists so consumers do not need to import from `react-hook-form` directly.

```tsx
import { FormProvider as RHFFormProvider, UseFormReturn, FieldValues } from "react-hook-form";

interface FormProviderProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  children: React.ReactNode;
}

export function FormProvider<T extends FieldValues>({ form, children }: FormProviderProps<T>) {
  return <RHFFormProvider {...form}>{children}</RHFFormProvider>;
}
```

Also re-export RHF's `useForm` and the zod resolver for convenience:
```ts
export { useForm } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";
```

#### useFormField (`client/lib/form/useFormField.ts`)

A hook that reads field state from the nearest `FormProvider` context. Used internally by the adapter components but also available for custom field components.

```ts
import { useFormContext, useController, FieldPath, FieldValues } from "react-hook-form";

interface UseFormFieldReturn<T extends FieldValues> {
  field: {
    value: any;
    onChange: (...event: any[]) => void;
    onBlur: () => void;
    name: string;
    ref: React.Ref<any>;
  };
  error: string | undefined;
  isTouched: boolean;
  isDirty: boolean;
}

export function useFormField<T extends FieldValues>(
  name: FieldPath<T>
): UseFormFieldReturn<T>;
```

Implementation: calls `useController({ name })` and `useFormContext()`, extracts `fieldState.error?.message`, `fieldState.isTouched`, `fieldState.isDirty`.

#### FormTextInput (`client/lib/form/FormTextInput.tsx`)

Wraps the existing `TextInput` from `client/components/ui/TextInput` with an RHF `Controller`.

```tsx
interface FormTextInputProps extends Omit<TextInputCustomProps, "value" | "onChangeText" | "onBlur"> {
  name: string;
}
```

Behavior:
- Reads `value`, `onChange`, `onBlur` from the Controller's `field` prop.
- Maps `onChange` to `onChangeText` (RHF passes a generic onChange; for TextInput it receives the string directly from `onChangeText`).
- Passes `error={!!fieldState.error}` and `errorText={fieldState.error?.message}` to the underlying TextInput, which already supports these props.
- Supports all existing TextInput props (`variant`, `size`, `label`, `helperText`, `required`, `secureTextEntry`, `leftElement`, `rightElement`, etc.) via passthrough.

#### FormCheckbox (`client/lib/form/FormCheckbox.tsx`)

Wraps `Checkbox` from `client/components/ui/Checkbox` with a Controller.

```tsx
interface FormCheckboxProps extends Omit<CheckboxProps, "checked" | "onCheckedChange"> {
  name: string;
}
```

Behavior:
- Maps `field.value` to `checked` and `field.onChange` to `onCheckedChange`.
- Passes `error={!!fieldState.error}` to the underlying Checkbox (already supports `error` prop).
- Displays error message below the checkbox using `FormMessage` if `fieldState.error` is present.

#### FormSwitch (`client/lib/form/FormSwitch.tsx`)

Wraps `Switch` from `client/components/ui/Switch` with a Controller.

```tsx
interface FormSwitchProps extends Omit<SwitchProps, "checked" | "onCheckedChange"> {
  name: string;
  label?: string;
}
```

Behavior:
- Maps `field.value` to `checked` and `field.onChange` to `onCheckedChange`.
- Renders an optional label alongside the switch (horizontal row layout).
- Displays error message below using `FormMessage`.

#### FormSelect (`client/lib/form/FormSelect.tsx`)

Stub adapter for a future `Select` component. Since no `Select` UI component exists yet:

- Accept `name`, `options: { value: string; label: string }[]`, `placeholder`, and `label` props.
- Render a basic implementation using `Pressable` + a simple dropdown or just display the selected value with an indication it is tappable. This does NOT need to be production-quality UI — it is a placeholder.
- Wire up Controller for value/onChange.
- When a proper `Select` component is built, this adapter will be updated to wrap it.

#### FormMessage (`client/lib/form/FormMessage.tsx`)

A small component that renders an error message string in the project's error style (matching the `errorText` styling in TextInput: destructive color, 12px font, `spacing.xs` top margin).

```tsx
interface FormMessageProps {
  error?: string;
}

export function FormMessage({ error }: FormMessageProps): JSX.Element | null;
```

Returns `null` when `error` is undefined.

#### Barrel Export (`client/lib/form/index.ts`)

```ts
export { FormProvider, useForm, zodResolver } from "./FormProvider";
export { useFormField } from "./useFormField";
export { FormTextInput } from "./FormTextInput";
export { FormCheckbox } from "./FormCheckbox";
export { FormSwitch } from "./FormSwitch";
export { FormSelect } from "./FormSelect";
export { FormMessage } from "./FormMessage";
```

---

### Part B: FormScreen Template (`client/screens/FormScreen.tsx`)

A configurable multi-step form screen template, following the patterns established by `SettingsScreen.tsx` (data-driven via props, `createStyles(theme)` pattern, staggered entrance animations).

#### Props

```tsx
import { z } from "zod";

interface FormStep {
  /** Step title displayed in the header */
  title: string;
  /** Optional step description */
  description?: string;
  /** Zod schema for validating this step's fields */
  schema: z.ZodType<any>;
  /** Render function for this step's form content */
  content: (form: UseFormReturn<any>) => React.ReactNode;
}

interface FormScreenProps {
  /** Array of form steps */
  steps: FormStep[];
  /** Called when the final step is submitted with all form data */
  onSubmit: (data: any) => void | Promise<void>;
  /** Optional: show a summary/review step before final submit */
  showReview?: boolean;
  /** Optional: render function for the review step */
  renderReview?: (data: any) => React.ReactNode;
  /** Optional: custom submit button text (default: "Submit") */
  submitLabel?: string;
  /** Optional: header content above the step indicator */
  header?: React.ReactNode;
  /** Optional: style override for the outer container */
  style?: StyleProp<ViewStyle>;
}
```

#### Layout

```
+--------------------------------------+
| [header]                             |
| [Step Indicator: (1) (2) (3) ...]    |
| [Step Title]                         |
| [Step Description]                   |
|                                      |
| +----------------------------------+ |
| | [Step Content - form fields]     | |
| |                                  | |
| +----------------------------------+ |
|                                      |
| [Back]                  [Next/Submit]|
+--------------------------------------+
```

#### Step Indicator

- Horizontal row of numbered circles connected by lines.
- Current step: `primary` background + `primaryForeground` text.
- Completed steps: `accent` background + white text + checkmark icon.
- Future steps: `muted` background + `mutedForeground` text.
- Responsive: if more than 5 steps, consider using a progress bar instead.

#### Navigation Behavior

- **Next** button: validates the current step's fields against `step.schema` before advancing. If validation fails, errors display inline on the form fields. The button should show a loading state if validation involves async operations.
- **Back** button: moves to the previous step without losing data. Hidden on step 1.
- **Submit** button (final step): validates, then calls `onSubmit` with the complete form data. Shows a loading spinner during submission.
- Keyboard-aware: the content area should scroll and avoid the keyboard. Use the project's `KeyboardProvider` from `client/features/keyboard/` or `KeyboardAvoidingView` as appropriate.

#### Per-Step Validation

Each step has its own `schema`. The form uses a single RHF `useForm` instance across all steps, but validation is scoped:
- When pressing "Next", call `trigger()` with only the field names from the current step's schema.
- This ensures earlier steps remain valid but the user is not blocked by errors on future steps they haven't reached yet.

#### Review Step (Optional)

When `showReview` is `true`, an additional step is appended after the last content step:
- Displays a read-only summary of all entered data.
- If `renderReview` is provided, it receives the full form data and returns custom JSX.
- If `renderReview` is not provided, render a default summary: a list of field labels and values in a card layout.
- The "Back" button from the review step returns to the last content step.

#### Animation

- Use `AnimatedView` with `fadeSlideUp` type and staggered delay for step transitions (matching how `SettingsScreen` animates sections).
- When navigating between steps, the outgoing step fades out and the incoming step fades in with a slide.

---

## File Structure

```
client/lib/form/
  index.ts
  FormProvider.tsx
  useFormField.ts
  FormTextInput.tsx
  FormCheckbox.tsx
  FormSwitch.tsx
  FormSelect.tsx
  FormMessage.tsx

client/screens/
  FormScreen.tsx          (NEW)
  SettingsScreen.tsx      (existing, reference for patterns)
  DetailHeroScreen.tsx    (existing)
  ListScreen.tsx          (existing)
  PricingScreen.tsx       (existing)
  ProfileScreen.tsx       (existing)
  WelcomeScreen.tsx       (existing)
```

---

## Dependencies

| Package | Action | Reason |
|---------|--------|--------|
| `react-hook-form` | `bun add react-hook-form` | Form state management |
| `zod` | `bun add zod` | Schema validation |
| `@hookform/resolvers` | `bun add @hookform/resolvers` | Zod-to-RHF bridge |

---

## Code Conventions

All new files must follow the project's established patterns:

- **Style:** Double quotes, semicolons, 2-space indent.
- **Theming:** Use `useTheme()` or `useStyles()` from `client/hooks/useTheme.ts`. Use `createStyles(theme)` pattern for StyleSheet (see `SettingsScreen.tsx`, `TextInput.tsx`).
- **Spacing:** Import from `@/client/constants/spacing`.
- **Fonts:** Import from `@/client/constants/fonts` when needed.
- **Imports:** Use `@/` path alias for cross-directory imports. Use relative imports within `client/lib/form/`.
- **Feature isolation:** `client/lib/form/` is part of the shared layer. It imports from `client/components/ui/` and `client/hooks/`, never from `client/features/`.
- **Style arrays:** NEVER pass style arrays to `@rn-primitives` components. Use `StyleSheet.flatten()`.
- **Web compatibility:** Test on web. Avoid `boxShadow` (causes RN Web crashes). Use `Platform.OS` checks where needed.

---

## Testing

### Part A Tests (`client/lib/form/__tests__/`)

**`FormTextInput.test.tsx`**
- Renders with a label.
- Displays error message from form validation.
- Calls `onChange` when text is entered.
- Calls `onBlur` when input loses focus.
- Shows required asterisk when `required` prop is set.
- Passes through `variant`, `size`, and other TextInput props.

**`FormCheckbox.test.tsx`**
- Renders with a label.
- Toggles checked state via form context.
- Displays error message when validation fails.
- Respects `disabled` prop.

**`FormSwitch.test.tsx`**
- Renders with a label.
- Toggles value via form context.
- Displays error message when validation fails.

**`useFormField.test.ts`**
- Returns `field` object with value, onChange, onBlur.
- Returns `error` string when field has validation error.
- Returns `isTouched` and `isDirty` flags.
- Throws or returns undefined gracefully when used outside FormProvider.

**Integration test: `FormIntegration.test.tsx`**
- Full form with TextInput + Checkbox + zod schema.
- Submit with valid data: `onSubmit` called with correct values.
- Submit with invalid data: error messages appear, `onSubmit` not called.
- Errors clear when field is corrected.

### Part B Tests (`client/screens/__tests__/`)

**`FormScreen.test.tsx`**
- Renders step indicator with correct number of steps.
- Displays first step content on mount.
- "Next" validates current step; shows errors if invalid.
- "Next" advances to step 2 when valid.
- "Back" returns to previous step with data preserved.
- "Submit" on final step calls `onSubmit` with all data.
- Review step (when `showReview` is true) renders after last content step.
- Back button is hidden on step 1.
- Step indicator shows completed state for finished steps.

---

## Acceptance Criteria

- [ ] `react-hook-form`, `zod`, and `@hookform/resolvers` are installed and in `package.json`.
- [ ] All files in `client/lib/form/` exist with correct exports.
- [ ] `FormTextInput` correctly wraps `TextInput` with Controller and displays validation errors.
- [ ] `FormCheckbox` correctly wraps `Checkbox` with Controller.
- [ ] `FormSwitch` correctly wraps `Switch` with Controller.
- [ ] `FormSelect` exists as a functional stub.
- [ ] `FormScreen` template renders a multi-step form with step indicator.
- [ ] Per-step validation prevents advancing with invalid data.
- [ ] Back navigation preserves entered data.
- [ ] Review step works when `showReview` is enabled.
- [ ] All tests pass.
- [ ] `npx expo lint` passes with no new warnings.
- [ ] TypeScript compiles with no errors.
- [ ] Web renders correctly (no style array crashes, no boxShadow issues).

---

## Out of Scope

- A full `Select` UI component (the `FormSelect` adapter is a stub for now).
- Refactoring the existing `form-demo.tsx` to use the new form system (separate task — but it should be trivial once this lands).
- Server-side validation or API integration (schemas can be shared via `shared/` in a future spec).
- File upload fields or media picker form fields.
- Form persistence (saving draft form data to storage).

---

## Risks & Open Questions

- **React 19 + RHF compatibility:** `react-hook-form` v7 should work with React 19. The project already uses React 19 (`"react": "19.2.0"`). Verify during implementation that `useForm`, `Controller`, and `FormProvider` function correctly. If v7 has issues, check if v8 (currently in development) is needed.
- **Bundle size:** `zod` adds ~13KB gzipped and `react-hook-form` adds ~9KB gzipped. Both are standard choices and the tradeoff is justified by the boilerplate elimination. If size becomes a concern, `zod` can be replaced with a lighter validator in the future since the adapter layer abstracts it.
- **FormSelect stub quality:** The stub needs to be functional enough for the FormScreen template to demonstrate multi-step forms that include a select field. It does not need to match the design system quality of TextInput/Checkbox/Switch.
- **KeyboardAvoidingView vs KeyboardProvider:** The project has a keyboard feature (`client/features/keyboard/`). FormScreen should use whatever the project's standard keyboard avoidance pattern is. Check `app/_layout.tsx` for the active provider and match that approach.
