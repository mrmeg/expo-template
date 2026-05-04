import React from "react";
import { View } from "react-native";
import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseControllerProps,
} from "react-hook-form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  type SelectSize,
} from "@mrmeg/expo-ui/components/Select";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { fontFamilies } from "@mrmeg/expo-ui/constants";
import { FormMessage } from "./FormMessage";

interface SelectOption {
  value: string;
  label: string;
}

type FormSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> & {
  /** Options to render as SelectItems */
  options: SelectOption[];
  /** Placeholder text shown when no value is selected */
  placeholder?: string;
  /** Label text displayed above the select */
  label?: string;
  /** Size variant for the trigger */
  size?: SelectSize;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Portal host name for the dropdown overlay */
  portalHost?: string;
};

/**
 * Select wired to react-hook-form via Controller.
 * Accepts an `options` array and renders SelectItems automatically.
 *
 * The @rn-primitives Select uses an Option type `{ value, label }` for its value.
 * This component maps between the form's string value and the Select's Option type.
 *
 * Usage:
 * ```tsx
 * <FormSelect
 *   name="country"
 *   label="Country"
 *   placeholder="Select a country"
 *   options={[
 *     { value: "us", label: "United States" },
 *     { value: "ca", label: "Canada" },
 *   ]}
 * />
 * ```
 */
export function FormSelect<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  rules,
  defaultValue,
  shouldUnregister,
  options,
  placeholder = "Select...",
  label,
  size,
  disabled,
  portalHost,
}: FormSelectProps<TFieldValues, TName>) {
  const { theme } = useTheme();
  const { field, fieldState } = useController({
    name,
    control,
    rules,
    defaultValue,
    shouldUnregister,
  });

  // Convert string value to Option format for the Select primitive
  const selectedOption = field.value
    ? options.find((opt) => opt.value === field.value) ?? {
      value: field.value as string,
      label: field.value as string,
    }
    : undefined;

  return (
    <View>
      {!!label && (
        <StyledText
          style={{
            fontFamily: fontFamilies.sansSerif.regular,
            fontWeight: "500",
            fontSize: 14,
            color: theme.colors.text,
            marginBottom: spacing.xs,
          }}
        >
          {label}
        </StyledText>
      )}
      <Select
        value={selectedOption}
        onValueChange={(option) => {
          field.onChange(option?.value);
        }}
        disabled={disabled}
      >
        <SelectTrigger size={size} error={!!fieldState.error}>
          <SelectValue placeholder={placeholder} size={size} />
        </SelectTrigger>
        <SelectContent portalHost={portalHost}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} label={option.label}>
              <StyledText style={{ color: theme.colors.text }}>
                {option.label}
              </StyledText>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}
