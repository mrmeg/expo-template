import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { BodyText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@mrmeg/expo-ui/components/Accordion";
import { Button } from "@mrmeg/expo-ui/components/Button";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqScreenProps {
  eyebrow?: string;
  title: string;
  description?: string;
  items: FaqItem[];
  /** "Still need help?" footer copy — omit to hide the footer entirely. */
  footerTitle?: string;
  footerDescription?: string;
  footerActionLabel?: string;
  onFooterAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FaqScreen
 *
 * `SectionHeader` followed by an `Accordion` of question/answer pairs, with
 * an optional "still need help" footer CTA.
 *
 * @example
 * ```tsx
 * <FaqScreen
 *   eyebrow="FAQ"
 *   title="Frequently asked questions"
 *   items={[
 *     { question: "Is there a free plan?", answer: "Yes — the free plan covers up to 3 projects." },
 *   ]}
 *   footerTitle="Still need help?"
 *   footerActionLabel="Contact support"
 *   onFooterAction={() => {}}
 * />
 * ```
 */
export function FaqScreen({
  eyebrow,
  title,
  description,
  items,
  footerTitle,
  footerDescription,
  footerActionLabel,
  onFooterAction,
  style: styleOverride,
}: FaqScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader eyebrow={eyebrow} title={title} description={description} style={styles.header} />

        <Accordion type="single" collapsible style={styles.accordion}>
          {items.map((item, index) => (
            <AccordionItem key={item.question} value={String(index)}>
              <AccordionTrigger>
                <BodyText style={styles.question}>{item.question}</BodyText>
              </AccordionTrigger>
              <AccordionContent>
                <BodyText style={styles.answer}>{item.answer}</BodyText>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {!!footerTitle && (
          <View style={styles.footer}>
            <SectionHeader align="center" title={footerTitle} description={footerDescription} />
            {!!footerActionLabel && onFooterAction && (
              <Button preset="outline" onPress={onFooterAction} text={footerActionLabel} style={styles.footerButton} />
            )}
          </View>
        )}
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
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      marginBottom: spacing.lg,
    },
    accordion: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    question: {
      flex: 1,
      color: theme.colors.foreground,
    },
    answer: {
      color: theme.colors.mutedForeground,
    },
    footer: {
      alignItems: "center",
      marginTop: spacing.xxl,
      paddingTop: spacing.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    footerButton: {
      marginTop: spacing.lg,
    },
  });
