import React, { ReactNode } from "react";
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
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
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
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  // Staggered entrance animations
  const avatarEntrance = useStaggeredEntrance({ type: "scale", delay: 0 });
  const nameEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY });
  const statsEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 2 });
  const actionsEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 3 });

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Stats Row: flat, on the screen gutter; no panel around it */}
        {stats && stats.length > 0 && (
          <Animated.View style={[statsEntrance, styles.statsRow]}>
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
                  fontWeight="medium"
                  style={{
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

        {/* Info Sections: full-width rows that carry their own 16pt inset */}
        {sections?.map((section) => (
          <ItemGroup key={section.title} title={section.title}>
            {section.items.map((item) => (
              <Item key={item.label} onPress={item.onPress}>
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
            ))}
          </ItemGroup>
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
    // No horizontal padding here: the hero, stats, and actions pad themselves
    // and the rows carry their own inset, so the screen has one 16pt gutter.
    content: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.sectionSpacing,
    },
    hero: {
      alignItems: "center",
      paddingHorizontal: spacing.screenPadding,
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
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.screenPadding,
    },
    statItem: {
      flex: 1,
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
      paddingHorizontal: spacing.screenPadding,
    },
    actionButton: {
      flex: 1,
    },
  });

const themedStyles = createThemedStyles(createStyles);
