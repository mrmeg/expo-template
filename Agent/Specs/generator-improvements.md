# Spec: Generator Script Improvements

**Status:** Ready
**Priority:** Low
**Scope:** Client — `scripts/generate.ts`

---

## Problem

The generator CLI (`scripts/generate.ts`) currently only supports `component` and `screen` scaffold types. Hooks must be written from scratch each time, and there is no form scaffold despite forms being a common pattern. Additionally, the script lacks input validation (PascalCase vs camelCase) and could provide better developer guidance after generation.

## Solution

Extend the generator with two new scaffold types (`hook` and `form`) and add quality-of-life improvements to the existing CLI.

---

## Changes

### A) New `hook` type

**Command:** `npx tsx scripts/generate.ts hook <Name>`

**Output:** `client/hooks/use<Name>.ts`

The name argument is normalized: if the user passes `Debounce`, the file becomes `useDebounce.ts`. If they pass `useDebounce`, it stays `useDebounce.ts` (strip the `use` prefix before re-adding it to avoid `useUseDebounce`).

**Template contents:**

```ts
import { useState, useEffect, useCallback } from "react";

interface Use<Name>Options {
  // TODO: Define hook options
}

/**
 * use<Name>
 *
 * TODO: Describe what this hook does.
 *
 * @param options - Configuration options
 * @returns TODO: Describe return value
 *
 * @example
 * ```tsx
 * const result = use<Name>();
 * ```
 */
export function use<Name>(options: Use<Name>Options = {}) {
  // TODO: Implement hook logic

  return {};
}
```

Key details:
- Import line includes `useState`, `useEffect`, `useCallback` as common starting points
- Options interface with the `Use<Name>Options` naming convention (matches `ScalePressOptions`, `StaggeredEntranceOptions` pattern)
- JSDoc block with `@param`, `@returns`, `@example` (matches `useScalePress` and `useStaggeredEntrance` patterns)
- Named export function (not arrow, consistent with all existing hooks)
- Returns an object (common hook return pattern in this codebase)
- No barrel file update needed since `client/hooks/` has no `index.ts` — each hook is imported directly by path

### B) New `form` type

**Command:** `npx tsx scripts/generate.ts form <Name>`

**Output:** `client/components/forms/<Name>Form.tsx`

Creates the `client/components/forms/` directory if it does not exist.

**Template contents:**

```tsx
import { View, StyleSheet } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText } from "@/client/components/ui/StyledText";
import { TextInput } from "@/client/components/ui/TextInput";
import { Button } from "@/client/components/ui/Button";
import type { Theme } from "@/client/constants/colors";

const <camelName>Schema = z.object({
  // TODO: Define your form fields
  // example: z.string().min(1, "Required"),
});

type <PascalName>FormData = z.infer<typeof <camelName>Schema>;

export interface <PascalName>FormProps {
  /**
   * Called when the form is submitted with valid data
   */
  onSubmit: (data: <PascalName>FormData) => void;
  /**
   * Whether the form is currently submitting
   */
  loading?: boolean;
}

/**
 * <PascalName>Form
 *
 * Usage:
 * ```tsx
 * <<PascalName>Form onSubmit={(data) => console.log(data)} />
 * ```
 */
export function <PascalName>Form({ onSubmit, loading = false }: <PascalName>FormProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { control, handleSubmit, formState: { errors } } = useForm<<PascalName>FormData>({
    resolver: zodResolver(<camelName>Schema),
    defaultValues: {
      // TODO: Set default values
    },
  });

  return (
    <View style={styles.container}>
      {/* TODO: Add form fields using Controller */}
      {/*
      <Controller
        control={control}
        name="example"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label="Example"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.example?.message}
          />
        )}
      />
      */}

      <Button
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        fullWidth
      >
        Submit
      </Button>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
  });
```

Key details:
- Uses `react-hook-form` + `zod` + `@hookform/resolvers` (standard RN form stack)
- Follows the `createStyles(theme)` pattern used by every component in this codebase
- Imports project components (`TextInput`, `Button`, `StyledText`) rather than raw RN inputs
- Schema placeholder with commented example field
- Controller usage shown in a comment block so the template compiles without errors
- `onSubmit` and `loading` props as the minimal useful interface

**Dependency note:** The form template imports `react-hook-form`, `zod`, and `@hookform/resolvers`. These are NOT currently in `package.json`. The generator should print a warning after creating a form file:

```
Note: This template requires additional dependencies.
  Run: bun add react-hook-form zod @hookform/resolvers
```

### C) Quality-of-life improvements

#### C1. Name validation

Add validation in `main()` before the switch statement:

- For `component`, `screen`, and `form`: warn if the name is not PascalCase or convertible to it (the existing `toPascalCase` handles conversion, so this is a yellow warning, not a hard error)
- For `hook`: warn if the name looks like it already has `use` prefix in the wrong case (e.g., `usedebounce`)
- All types: error if name contains spaces or special characters beyond hyphens/underscores

Implementation: add a `validateName(type, name)` function that returns `{ valid: boolean; warnings: string[] }`. Print warnings in yellow but proceed. Hard-fail only on truly invalid names (empty, has spaces, starts with a number).

#### C2. Better "file exists" error

The current error message is already handled (lines 189 and 209 print red errors). Enhance these to also suggest what the user can do:

```
Error: Component MyButton.tsx already exists at client/components/ui/MyButton.tsx
  To overwrite, delete the existing file first.
```

Add the full relative path to help the developer locate the file. Apply this same pattern to all four types.

#### C3. Print import path after generation

The `component` type already does this (line 198). Ensure all types print a copy-pasteable import statement:

- **hook:** `import { use<Name> } from "@/client/hooks/use<Name>";`
- **form:** `import { <Name>Form } from "@/client/components/forms/<Name>Form";`
- **screen:** Already prints the route path, no change needed.

#### C4. Update help text

Update `showHelp()` to list all four types with examples:

```
Types:
  component  - Create a new UI component in client/components/ui/
  screen     - Create a new screen in app/(main)/
  hook       - Create a new hook in client/hooks/
  form       - Create a new form component in client/components/forms/

Examples:
  npm run generate component MyButton
  npm run generate screen Settings
  npm run generate hook Debounce
  npm run generate form ContactInfo
```

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `scripts/generate.ts` | Modify | Add `hook` and `form` cases, `getHookTemplate()`, `getFormTemplate()`, `validateName()`, enhanced error messages, updated help text |

One file modified, no new files (other than the generated output at runtime).

---

## Testing

Manual verification — the generator is a CLI tool, not a runtime component.

1. **Hook generation:**
   - `npx tsx scripts/generate.ts hook Debounce` creates `client/hooks/useDebounce.ts`
   - `npx tsx scripts/generate.ts hook useDebounce` also creates `useDebounce.ts` (no doubling)
   - `npx tsx scripts/generate.ts hook my-custom-hook` creates `useMyCustomHook.ts`
   - Running again on same name prints the "already exists" error with path
   - Output includes the import path

2. **Form generation:**
   - `npx tsx scripts/generate.ts form ContactInfo` creates `client/components/forms/ContactInfoForm.tsx`
   - The `forms/` directory is created if missing
   - Output includes the dependency warning
   - Output includes the import path
   - Generated file has no TypeScript errors (all TODO fields are in comments)

3. **Validation:**
   - `npx tsx scripts/generate.ts component "has spaces"` prints error
   - `npx tsx scripts/generate.ts hook 123invalid` prints error
   - `npx tsx scripts/generate.ts component myButton` prints yellow warning about casing but still generates with PascalCase

4. **Existing types unchanged:**
   - `npx tsx scripts/generate.ts component Foo` still works exactly as before
   - `npx tsx scripts/generate.ts screen Bar` still works exactly as before

5. **Help:**
   - `npx tsx scripts/generate.ts --help` shows all four types

6. **Cleanup:** Delete any generated test files after verification.

---

## Risks

- **Low:** The form template imports packages that may not be installed. Mitigated by the printed dependency warning.
- **Low:** Adding `client/components/forms/` as a new directory. This is a convention choice. It sits alongside `client/components/ui/` which is an established pattern.
- **None:** All changes are additive to the generator script. Existing `component` and `screen` behavior is untouched except for improved error messages.

---

## Out of Scope

- Generator for Zustand stores (different enough to warrant its own spec)
- Generator for feature folders (involves multiple files and directory structure)
- Interactive prompts or wizard mode
- Updating any barrel/index files (hooks have no barrel; forms directory is new)
