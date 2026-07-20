import React from "react";
import { View, StyleProp, ViewStyle, TextStyle } from "react-native";
import { EyebrowText, TitleText, BodyText, type TextProps } from "./StyledText";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";

type TextPassthroughProps = Omit<TextProps, "style" | "children"> & {
  style?: StyleProp<TextStyle>;
};

export interface SectionHeaderProps {
  /** Small uppercase label rendered above the title. */
  eyebrow?: string;
  /** Section title. */
  title: string;
  /** Supporting copy rendered below the title. */
  description?: string;
  /** Text alignment for the whole block. @default "leading" */
  align?: "leading" | "center";
  /** Custom style override for the container. */
  style?: StyleProp<ViewStyle>;
  /** Passthrough props for the title text. */
  titleProps?: TextPassthroughProps;
  /** Passthrough props for the description text. */
  descriptionProps?: TextPassthroughProps;
}

/**
 * SectionHeader
 *
 * Composed eyebrow -> title -> description block used to introduce a page
 * section. Supports a leading (default) or centered alignment; centered
 * descriptions are width-constrained so long copy doesn't stretch edge to
 * edge.
 *
 * @example
 * ```tsx
 * <SectionHeader
 *   eyebrow="Pricing"
 *   title="Simple, transparent plans"
 *   description="Pick the plan that fits your team. Upgrade or cancel anytime."
 *   align="center"
 * />
 * ```
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "leading",
  style,
  titleProps,
  descriptionProps,
}: SectionHeaderProps) {
  const { theme } = useTheme();
  const isCentered = align === "center";
  const textAlign = isCentered ? "center" : "left";

  return (
    <View style={[{ alignItems: isCentered ? "center" : "flex-start" }, style]}>
      {!!eyebrow && (
        <EyebrowText
          style={{
            color: theme.colors.accent,
            marginBottom: spacing.xs,
            textAlign,
          }}
        >
          {eyebrow}
        </EyebrowText>
      )}

      <TitleText
        {...titleProps}
        style={[
          { textAlign },
          !!description && { marginBottom: spacing.sm },
          titleProps?.style,
        ]}
      >
        {title}
      </TitleText>

      {!!description && (
        <BodyText
          {...descriptionProps}
          style={[
            { color: theme.colors.textDim, textAlign },
            isCentered && { maxWidth: 560 },
            descriptionProps?.style,
          ]}
        >
          {description}
        </BodyText>
      )}
    </View>
  );
}
