import React from "react";
import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseControllerProps,
} from "react-hook-form";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";

type TextInputProps = React.ComponentProps<typeof TextInput>;

type FormTextInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> &
  Omit<TextInputProps, "value" | "onChangeText" | "onBlur" | "ref">;

/**
 * TextInput wired to react-hook-form via Controller.
 * Passes error/errorText from field state to TextInput's existing props.
 *
 * Usage:
 * ```tsx
 * <FormTextInput name="email" label="Email" placeholder="you@example.com" />
 * ```
 */
export function FormTextInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  rules,
  defaultValue,
  shouldUnregister,
  ...inputProps
}: FormTextInputProps<TFieldValues, TName>) {
  // Destructured, not read off `field`: passing `field.ref` as a JSX ref makes
  // the React Compiler infer `field` itself is a ref, so every `field.*` read
  // during render counted as a ref access and it skipped this component.
  const {
    field: { ref, value, onChange, onBlur },
    fieldState,
  } = useController({
    name,
    control,
    rules,
    defaultValue,
    shouldUnregister,
  });

  return (
    <TextInput
      {...inputProps}
      ref={ref}
      value={value ?? ""}
      onChangeText={onChange}
      onBlur={onBlur}
      error={!!fieldState.error || inputProps.error}
      errorText={fieldState.error?.message ?? inputProps.errorText}
    />
  );
}
