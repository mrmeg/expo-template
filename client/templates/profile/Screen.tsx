import React, { useMemo, ReactNode } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
} from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useStaggeredEntrance, STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText, EyebrowText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@mrmeg/expo-ui/components/Item";
import type { Theme } from "@mrmeg/expo-ui/constants";

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
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Staggered entrance animations
  const avatarEntrance = useStaggeredEntrance({ type: "scale", delay: 0 });
  const nameEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY });
  const statsEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 2 });
  const actionsEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 3 });

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name */}
        <View style={styles.hero}>
          <Animated.View style={avatarEntrance}>
            <View style={styles.avatar}>
              {avatarContent || (
                <SansSerifBoldText size="display" style={styles.avatarFallback}>
                  {name.charAt(0).toUpperCase()}
                </SansSerifBoldText>
              )}
            </View>
          </Animated.View>

          <Animated.View style={nameEntrance}>
            <SectionHeader align="center" title={name} description={subtitle} />

            {badge && (
              <Badge variant="outline" style={styles.badge}>
                {badge}
              </Badge>
            )}
          </Animated.View>
        </View>

        {/* Stats Row */}
        {stats && stats.length > 0 && (
          <Animated.View style={[statsEntrance, styles.statsCard, getShadowStyle("subtle")]}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Icon name={stat.icon} size={20} color={theme.colors.accent} />
                <SansSerifBoldText size="xl" style={styles.statValue}>{stat.value}</SansSerifBoldText>
                <SansSerifText size="sm" style={styles.statLabel}>{stat.label}</SansSerifText>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Action Buttons */}
        {actions && actions.length > 0 && (
          <Animated.View style={[styles.actions, actionsEntrance]}>
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
          </Animated.View>
        )}

        {/* Info Sections */}
        {sections?.map((section) => (
          <View key={section.title} style={styles.section}>
            <EyebrowText style={[styles.sectionTitle, { color: theme.colors.mutedForeground }]}>
              {section.title}
            </EyebrowText>

            <View style={[styles.card, getShadowStyle("subtle")]}>
              {section.items.map((item, index) => {
                const isLast = index === section.items.length - 1;
                return (
                  <Item key={item.label} onPress={item.onPress} separator={!isLast}>
                    {item.icon && <ItemMedia icon={item.icon} iconColor="primary" />}
                    <ItemContent>
                      <ItemTitle>{item.label}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      {item.value && <ItemDescription>{item.value}</ItemDescription>}
                      {item.onPress && (
                        <Icon name="chevron-right" color={theme.colors.mutedForeground} size={20} />
                      )}
                    </ItemActions>
                  </Item>
                );
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
      width: 88,
      height: 88,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    avatarFallback: {
      color: theme.colors.accentForeground,
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
      color: theme.colors.foreground,
    },
    statLabel: {
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
  });
