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
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import { Button } from "@/client/components/ui/Button";
import { Badge } from "@/client/components/ui/Badge";
import type { Theme } from "@/client/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileStat {
  icon: IconName;
  value: string;
  label: string;
}

export interface ProfileAction {
  label: string;
  icon?: IconName;
  preset?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  onPress: () => void;
}

export interface ProfileInfoItem {
  icon?: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
}

export interface ProfileSection {
  title: string;
  items: ProfileInfoItem[];
}

export interface ProfileScreenProps {
  name: string;
  subtitle?: string;
  badge?: string;
  avatarContent?: ReactNode;
  stats?: ProfileStat[];
  actions?: ProfileAction[];
  sections?: ProfileSection[];
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileScreen({
  name,
  subtitle,
  badge,
  avatarContent,
  stats,
  actions,
  sections,
  style: styleOverride,
}: ProfileScreenProps) {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {avatarContent || (
              <SansSerifBoldText style={styles.avatarFallback}>
                {name.charAt(0).toUpperCase()}
              </SansSerifBoldText>
            )}
          </View>

          <SansSerifBoldText style={styles.name}>{name}</SansSerifBoldText>

          {subtitle && (
            <SansSerifText style={styles.subtitle}>{subtitle}</SansSerifText>
          )}

          {badge && (
            <Badge variant="outline" style={styles.badge}>
              {badge}
            </Badge>
          )}
        </View>

        {/* Stats Row */}
        {stats && stats.length > 0 && (
          <View style={[styles.statsCard, getShadowStyle("subtle")]}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Icon name={stat.icon} size={20} color={theme.colors.accent} />
                <SansSerifBoldText style={styles.statValue}>{stat.value}</SansSerifBoldText>
                <SansSerifText style={styles.statLabel}>{stat.label}</SansSerifText>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {actions && actions.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                preset={action.preset || "default"}
                onPress={action.onPress}
                size="md"
                style={styles.actionButton}
              >
                {action.icon && (
                  <Icon
                    name={action.icon}
                    size={16}
                    color={
                      action.preset === "outline" || action.preset === "ghost"
                        ? theme.colors.foreground
                        : theme.colors.accentForeground
                    }
                    style={{ marginRight: spacing.xs }}
                  />
                )}
                <SansSerifText
                  style={{
                    fontWeight: "500",
                    color:
                      action.preset === "outline" || action.preset === "ghost"
                        ? theme.colors.foreground
                        : theme.colors.accentForeground,
                  }}
                >
                  {action.label}
                </SansSerifText>
              </Button>
            ))}
          </View>
        )}

        {/* Info Sections */}
        {sections?.map((section) => (
          <View key={section.title} style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>
              {section.title}
            </SansSerifBoldText>

            <View style={[styles.card, getShadowStyle("subtle")]}>
              {section.items.map((item, index) => {
                const isLast = index === section.items.length - 1;
                const content = (
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
                      <View style={styles.rowRight}>
                        {item.value && (
                          <SansSerifText style={styles.value}>{item.value}</SansSerifText>
                        )}
                        {item.onPress && (
                          <Icon name="chevron-right" color={theme.colors.mutedForeground} size={20} />
                        )}
                      </View>
                    </View>
                    {!isLast && <View style={item.icon ? styles.dividerInset : styles.divider} />}
                  </View>
                );

                if (item.onPress) {
                  return (
                    <Pressable
                      key={item.label}
                      onPress={item.onPress}
                      style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
                    >
                      {content}
                    </Pressable>
                  );
                }

                return content;
              })}
            </View>
          </View>
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
    },
    hero: {
      alignItems: "center",
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    avatarFallback: {
      fontSize: 32,
      color: theme.colors.accentForeground,
    },
    name: {
      fontSize: 24,
      letterSpacing: -0.5,
      color: theme.colors.foreground,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xxs,
    },
    badge: {
      marginTop: spacing.sm,
      alignSelf: "center",
    },
    statsCard: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    statItem: {
      alignItems: "center",
      gap: spacing.xxs,
    },
    statValue: {
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    actionButton: {
      flex: 1,
    },
    section: {
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
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
  });
