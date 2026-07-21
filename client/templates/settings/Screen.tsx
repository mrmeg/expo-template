import React, { useMemo, ReactNode } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, EyebrowText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@mrmeg/expo-ui/components/Item";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsItemBase {
  icon?: IconName;
  label: string;
}

export interface SettingsNavigateItem extends SettingsItemBase {
  type: "navigate";
  value?: string;
  onPress: () => void;
}

export interface SettingsToggleItem extends SettingsItemBase {
  type: "toggle";
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export interface SettingsSelectItem extends SettingsItemBase {
  type: "select";
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export interface SettingsInfoItem extends SettingsItemBase {
  type: "info";
  value: string;
}

export interface SettingsDestructiveItem extends SettingsItemBase {
  type: "destructive";
  onPress: () => void;
}

export type SettingsItem =
  | SettingsNavigateItem
  | SettingsToggleItem
  | SettingsSelectItem
  | SettingsInfoItem
  | SettingsDestructiveItem;

export interface SettingsSection {
  title: string;
  footer?: string;
  items: SettingsItem[];
}

export interface SettingsScreenProps {
  sections: SettingsSection[];
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsScreen({ sections, header, style: styleOverride }: SettingsScreenProps) {
  const { theme, getShadowStyle, withAlpha } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderItem = (item: SettingsItem, isLast: boolean) => {
    switch (item.type) {
    case "navigate":
      return (
        <Item key={item.label} onPress={item.onPress} separator={!isLast}>
          {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
          </ItemContent>
          <ItemActions>
            {item.value && <ItemDescription>{item.value}</ItemDescription>}
            <Icon name="chevron-right" color={theme.colors.mutedForeground} size={20} />
          </ItemActions>
        </Item>
      );

    case "toggle":
      return (
        <Item key={item.label} separator={!isLast}>
          {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch checked={item.value} onCheckedChange={item.onValueChange} />
          </ItemActions>
        </Item>
      );

    case "select":
      return (
        <View key={item.label}>
          {item.options.map((option, optIndex) => {
            const isSelected = option.value === item.selectedValue;
            const isLastOpt = optIndex === item.options.length - 1;
            return (
              <Item
                key={option.value}
                onPress={() => item.onSelect(option.value)}
                separator={!(isLastOpt && isLast)}
              >
                {item.icon && (
                  <ItemMedia
                    icon={optIndex === 0 ? item.icon : undefined}
                    iconColor="primary"
                    style={optIndex > 0 && styles.iconSpacer}
                  />
                )}
                <ItemContent>
                  <ItemTitle>{option.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </ItemActions>
              </Item>
            );
          })}
        </View>
      );

    case "info":
      return (
        <Item key={item.label} separator={!isLast}>
          {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ItemDescription>{item.value}</ItemDescription>
          </ItemActions>
        </Item>
      );

    case "destructive":
      return (
        <Item key={item.label} onPress={item.onPress} separator={!isLast}>
          {item.icon && (
            <ItemMedia
              icon={item.icon}
              iconColor="destructive"
              style={{ backgroundColor: withAlpha(theme.colors.destructive, 0.12) }}
            />
          )}
          <ItemContent>
            <ItemTitle style={{ color: theme.colors.destructive }}>{item.label}</ItemTitle>
          </ItemContent>
        </Item>
      );
    }
  };

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {header}

        {sections.map((section, sectionIndex) => (
          <AnimatedView key={section.title} type="fadeSlideUp" delay={STAGGER_DELAY * (sectionIndex + 1)}>
            <View style={styles.section}>
              <EyebrowText style={[styles.sectionTitle, { color: theme.colors.mutedForeground }]}>
                {section.title}
              </EyebrowText>

              <View style={[styles.card, getShadowStyle("subtle")]}>
                {section.items.map((item, index) =>
                  renderItem(item, index === section.items.length - 1)
                )}
              </View>

              {section.footer && (
                <SansSerifText size="sm" style={styles.footer}>{section.footer}</SansSerifText>
              )}
            </View>
          </AnimatedView>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      marginBottom: spacing.sm + 2,
      marginLeft: spacing.xxs,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    // Transparent placeholder matching ItemMedia's default footprint, so a
    // select row with no icon still aligns its label under the first row's
    // icon column instead of ItemMedia's muted background showing through.
    iconSpacer: {
      backgroundColor: "transparent",
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: spacing.radiusFull,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.primary,
    },
    footer: {
      color: theme.colors.mutedForeground,
      marginTop: spacing.sm,
      marginLeft: spacing.xxs,
    },
  });
