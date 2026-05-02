import React from "react";
import { StyleSheet, View } from "react-native";
import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseControllerProps,
} from "react-hook-form";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { FormMessage } from "./FormMessage";

type SwitchProps = React.ComponentProps<typeof Switch>;

type FormSwitchProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> &
  Omit<SwitchProps, "checked" | "onCheckedChange"> & {
    /** Optional label displayed next to the switch */
    label?: string;
  };

/**
 * Switch wired to react-hook-form via Controller.
 * Maps field.value to checked and field.onChange to onCheckedChange.
 *
 * Usage:
 * ```tsx
 * <FormSwitch name="notifications" label="Enable notifications" />
 * ```
 */
export function FormSwitch<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  rules,
  defaultValue,
  shouldUnregister,
  label,
  ...switchProps
}: FormSwitchProps<TFieldValues, TName>) {
  const { theme } = useTheme();
  const { field, fieldState } = useController({
    name,
    control,
    rules,
    defaultValue,
    shouldUnregister,
  });

  const switchElement = (
    <Switch
      {...switchProps}
      checked={!!field.value}
      onCheckedChange={field.onChange}
    />
  );

  if (!label) {
    return (
      <View>
        {switchElement}
        <FormMessage message={fieldState.error?.message} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <StyledText style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </StyledText>
        {switchElement}
      </View>
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
});
