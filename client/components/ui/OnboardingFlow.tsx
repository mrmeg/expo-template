import React, { useRef, useState, useCallback } from "react";
import {
  View,
  FlatList,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  ViewToken,
} from "react-native";
import { SansSerifBoldText, SansSerifText } from "./StyledText";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import type { Theme } from "@/client/constants/colors";

// ============================================================================
// Types
// ============================================================================

export interface OnboardingPage {
  /** Icon name to display */
  icon: IconName;
  /** Page title */
  title: string;
  /** Page description */
  description: string;
}

export interface OnboardingFlowProps {
  /** Array of page data */
  pages: OnboardingPage[];
  /** Called when the flow completes (user taps Done on last page) */
  onComplete: () => void;
  /** Called when user taps Skip */
  onSkip?: () => void;
  /** Label for the final button */
  doneLabel?: string;
  /** Label for the next button */
  nextLabel?: string;
  /** Label for the skip button */
  skipLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * OnboardingFlow Component
 *
 * A horizontal paging onboarding experience with dot indicators,
 * skip button, and next/done navigation.
 *
 * @example
 * ```tsx
 * <OnboardingFlow
 *   pages={[
 *     { icon: "compass", title: "Explore", description: "Discover new features" },
 *     { icon: "layers", title: "Components", description: "Ready-made UI" },
 *     { icon: "zap", title: "Ship Fast", description: "Launch in days" },
 *   ]}
 *   onComplete={() => router.back()}
 *   onSkip={() => router.back()}
 * />
 * ```
 */
export function OnboardingFlow({
  pages,
  onComplete,
  onSkip,
  doneLabel = "Get Started",
  nextLabel = "Next",
  skipLabel = "Skip",
}: OnboardingFlowProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = Dimensions.get("window");

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Dot indicator animation values
  const dotWidths = useRef(pages.map((_, i) => new Animated.Value(i === 0 ? 24 : 8))).current;

  const isLastPage = currentIndex === pages.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setCurrentIndex(newIndex);

        // Animate dot widths
        dotWidths.forEach((dotWidth, i) => {
          Animated.timing(dotWidth, {
            toValue: i === newIndex ? 24 : 8,
            duration: 200,
            useNativeDriver: false,
          }).start();
        });
      }
    },
    [dotWidths]
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (isLastPage) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  const renderPage = ({ item }: { item: OnboardingPage }) => (
    <View style={[styles.page, { width: screenWidth }]}>
      <View style={styles.iconContainer}>
        <Icon name={item.icon} size={80} color={theme.colors.accent} />
      </View>
      <SansSerifBoldText style={styles.pageTitle}>{item.title}</SansSerifBoldText>
      <SansSerifText style={styles.pageDescription}>{item.description}</SansSerifText>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <View style={styles.skipContainer}>
        {!isLastPage && (
          <Button preset="ghost" onPress={handleSkip}>
            <SansSerifText style={styles.skipText}>{skipLabel}</SansSerifText>
          </Button>
        )}
      </View>

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={(_, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        {...(Platform.OS === "web" && {
          snapToInterval: screenWidth,
          decelerationRate: "fast",
        })}
      />

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {pages.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidths[index],
                  backgroundColor:
                    index === currentIndex
                      ? theme.colors.accent
                      : theme.colors.muted,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Done button */}
        <Button
          preset="default"
          fullWidth
          onPress={handleNext}
          style={styles.nextButton}
        >
          {isLastPage ? doneLabel : nextLabel}
        </Button>
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    skipContainer: {
      alignItems: "flex-end",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      minHeight: 44,
    },
    skipText: {
      fontSize: 16,
      color: theme.colors.mutedForeground,
    },
    page: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    iconContainer: {
      marginBottom: spacing.xl,
    },
    pageTitle: {
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.5,
      color: theme.colors.foreground,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    pageDescription: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      maxWidth: 300,
    },
    bottomControls: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    dotsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.xs,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    nextButton: {
      // Button already has proper padding from preset
    },
  });
