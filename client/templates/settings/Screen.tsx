import React, { ReactNode } from "react";
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
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@mrmeg/expo-ui/components/Item";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
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
  const { theme, withAlpha } = useTheme();
  const styles = themedStyles(theme);

  // One element per row: a select item expands into one row per option, so
  // the group can draw the hairline between options too.
  const renderRows = (item: SettingsItem): React.ReactElement[] => {
    switch (item.type) {
    case "navigate":
      return [
        <Item key={item.label} onPress={item.onPress}>
          {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
          </ItemContent>
          <ItemActions>
            {item.value && <ItemDescription>{item.value}</ItemDescription>}
            <Icon name="chevron-right" color={theme.colors.mutedForeground} size={20} />
          </ItemActions>
        </Item>,
      ];

    case "toggle":
      return [
        <Item key={item.label}>
          {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch checked={item.value} onCheckedChange={item.onValueChange} />
          </ItemActions>
        </Item>,
      ];

    case "select":
      return item.options.map((option, optIndex) => {
        const isSelected = option.value === item.selectedValue;
        return (
          <Item key={`${item.label}:${option.value}`} onPress={() => item.onSelect(option.value)}>
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
      });

    case "info":
      return [
        <Item key={item.label}>
          {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ItemDescription>{item.value}</ItemDescription>
          </ItemActions>
        </Item>,
      ];

    case "destructive":
      return [
        <Item key={item.label} onPress={item.onPress}>
          {item.icon && (
            <ItemMedia
              icon={item.icon}
              iconColor="destructive"
              style={{
                // eslint-disable-next-line expo-ui/no-restyle -- destructive icon tile tint; ItemMedia has no tinted variant
                backgroundColor: withAlpha(theme.colors.destructive, 0.12),
              }}
            />
          )}
          <ItemContent>
            <ItemTitle style={{ color: theme.colors.destructive }}>{item.label}</ItemTitle>
          </ItemContent>
        </Item>,
      ];
    }
  };

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Rows carry the screen's 16pt inset themselves, so only the
            free-form header gets horizontal padding. */}
        {header ? <View style={styles.header}>{header}</View> : null}

        {sections.map((section, sectionIndex) => (
          <AnimatedView key={section.title} type="fadeSlideUp" delay={STAGGER_DELAY * (sectionIndex + 1)}>
            <ItemGroup title={section.title} footer={section.footer}>
              {section.items.flatMap(renderRows)}
            </ItemGroup>
          </AnimatedView>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 640;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.sectionSpacing,
    },
    header: {
      paddingHorizontal: spacing.screenPadding,
    },
    // Transparent placeholder matching ItemMedia's default footprint, so a
    // select row with no icon still aligns its label under the first row's
    // icon column instead of ItemMedia's muted background showing through.
    iconSpacer: {
      // eslint-disable-next-line expo-ui/no-restyle -- blank icon-column placeholder; ItemMedia has no untinted variant
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
  });

const themedStyles = createThemedStyles(createStyles);
