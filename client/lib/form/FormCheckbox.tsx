import React from "react";
import { View } from "react-native";
import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseControllerProps,
} from "react-hook-form";
import { Checkbox, type CheckboxProps } from "@/client/components/ui/Checkbox";
import { FormMessage } from "./FormMessage";

type FormCheckboxProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> &
  Omit<CheckboxProps, "checked" | "onCheckedChange">;

/**
 * Checkbox wired to react-hook-form via Controller.
 * Maps field.value to checked and field.onChange to onCheckedChange.
 *
 * Usage:
 * ```tsx
 * <FormCheckbox name="acceptTerms" label="I accept the terms" />
 * ```
 */
export function FormCheckbox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  rules,
  defaultValue,
  shouldUnregister,
  ...checkboxProps
}: FormCheckboxProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules,
    defaultValue,
    shouldUnregister,
  });

  return (
    <View>
      <Checkbox
        {...checkboxProps}
        checked={!!field.value}
        onCheckedChange={field.onChange}
        error={!!fieldState.error || checkboxProps.error}
      />
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}
