import React from "react";
import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseControllerProps,
} from "react-hook-form";
import { TextInput } from "@/client/components/ui/TextInput";

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
  const { field, fieldState } = useController({
    name,
    control,
    rules,
    defaultValue,
    shouldUnregister,
  });

  return (
    <TextInput
      {...inputProps}
      ref={field.ref}
      value={field.value ?? ""}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      error={!!fieldState.error || inputProps.error}
      errorText={fieldState.error?.message ?? inputProps.errorText}
    />
  );
}
