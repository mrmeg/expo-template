import React, { ReactNode } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { useTheme } from "@/client/hooks/useTheme";
import { STAGGER_DELAY } from "@/client/hooks/useStaggeredEntrance";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import { Switch } from "@/client/components/ui/Switch";
import type { Theme } from "@/client/constants/colors";

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
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  const renderItem = (item: SettingsItem, isLast: boolean) => {
    switch (item.type) {
      case "navigate":
        return (
          <View key={item.label}>
            <Pressable
              onPress={item.onPress}
              style={Platform.OS === "web" ? { ...styles.row, cursor: "pointer" as any } : styles.row}
            >
              <View style={styles.rowLeft}>
                {item.icon && (
                  <View style={styles.iconContainer}>
                    <Icon name={item.icon} color={theme.colors.primary} size={20} />
                  </View>
                )}
                <SansSerifText style={styles.label}>{item.label}</SansSerifText>
              </View>
              <View style={styles.rowRight}>
                {item.value && (
                  <SansSerifText style={styles.value}>{item.value}</SansSerifText>
                )}
                <Icon name="chevron-right" color={theme.colors.mutedForeground} size={20} />
              </View>
            </Pressable>
            {!isLast && <View style={item.icon ? styles.dividerInset : styles.divider} />}
          </View>
        );

      case "toggle":
        return (
          <View key={item.label}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                {item.icon && (
                  <View style={styles.iconContainer}>
                    <Icon name={item.icon} color={theme.colors.primary} size={20} />
                  </View>
                )}
                <SansSerifText style={styles.label}>{item.label}</SansSerifText>
              </View>
              <Switch checked={item.value} onCheckedChange={item.onValueChange} />
            </View>
            {!isLast && <View style={item.icon ? styles.dividerInset : styles.divider} />}
          </View>
        );

      case "select":
        return (
          <View key={item.label}>
            {item.options.map((option, optIndex) => {
              const isSelected = option.value === item.selectedValue;
              const isLastOpt = optIndex === item.options.length - 1;
              return (
                <View key={option.value}>
                  <Pressable
                    onPress={() => item.onSelect(option.value)}
                    style={Platform.OS === "web" ? { ...styles.row, cursor: "pointer" as any } : styles.row}
                  >
                    <View style={styles.rowLeft}>
                      {item.icon && optIndex === 0 && (
                        <View style={styles.iconContainer}>
                          <Icon name={item.icon} color={theme.colors.primary} size={20} />
                        </View>
                      )}
                      {item.icon && optIndex > 0 && <View style={styles.iconSpacer} />}
                      <SansSerifText style={styles.label}>{option.label}</SansSerifText>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>
                  {!(isLastOpt && isLast) && <View style={item.icon ? styles.dividerInset : styles.divider} />}
                </View>
              );
            })}
          </View>
        );

      case "info":
        return (
          <View key={item.label}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                {item.icon && (
                  <View style={styles.iconContainer}>
                    <Icon name={item.icon} color={theme.colors.primary} size={20} />
                  </View>
                )}
                <SansSerifText style={styles.label}>{item.label}</SansSerifText>
              </View>
              <SansSerifText style={styles.value}>{item.value}</SansSerifText>
            </View>
            {!isLast && <View style={item.icon ? styles.dividerInset : styles.divider} />}
          </View>
        );

      case "destructive":
        return (
          <View key={item.label}>
            <Pressable
              onPress={item.onPress}
              style={Platform.OS === "web" ? { ...styles.row, cursor: "pointer" as any } : styles.row}
            >
              <View style={styles.rowLeft}>
                {item.icon && (
                  <View style={[styles.iconContainer, { backgroundColor: theme.colors.destructive + "20" }]}>
                    <Icon name={item.icon} color={theme.colors.destructive} size={20} />
                  </View>
                )}
                <SansSerifText style={[styles.label, { color: theme.colors.destructive }]}>
                  {item.label}
                </SansSerifText>
              </View>
            </Pressable>
            {!isLast && <View style={styles.divider} />}
          </View>
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
            <SansSerifBoldText style={styles.sectionTitle}>
              {section.title}
            </SansSerifBoldText>

            <View style={[styles.card, getShadowStyle("subtle")]}>
              {section.items.map((item, index) =>
                renderItem(item, index === section.items.length - 1)
              )}
            </View>

            {section.footer && (
              <SansSerifText style={styles.footer}>{section.footer}</SansSerifText>
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
      fontSize: 14,
      color: theme.colors.foreground,
      opacity: 0.6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    iconSpacer: {
      width: 36,
      marginRight: spacing.md,
    },
    label: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    value: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerInset: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginLeft: spacing.md + 36 + spacing.md,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
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
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
    },
    footer: {
      fontSize: 12,
      color: theme.colors.foreground,
      opacity: 0.5,
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
  });
