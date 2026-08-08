import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { BodyText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@mrmeg/expo-ui/components/Accordion";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaqSectionItem {
  question: string;
  answer: string;
}

export interface FaqSectionBlockProps {
  /** Small uppercase label above the heading. */
  eyebrow?: string;
  /** Section heading. */
  title?: string;
  /** Supporting copy below the heading. */
  description?: string;
  /** Question/answer pairs, rendered as a single-open accordion. */
  items?: FaqSectionItem[];
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ITEMS: FaqSectionItem[] = [
  {
    question: "What's the difference between a block and a template?",
    answer:
      "A template is a full screen with routing and state. A block is one section of a screen — a template is mostly blocks in a column.",
  },
  {
    question: "Can I use blocks outside the template app?",
    answer:
      "Yes. Blocks are open code: copy the folder into your project. They only import from @mrmeg/expo-ui, which publishes to npm.",
  },
  {
    question: "Do blocks work on web?",
    answer:
      "Yes. Every block registers its themed styles at module scope so the server-rendered HTML ships fully styled.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FaqSectionBlock
 *
 * `SectionHeader` above a single-open `Accordion` of question/answer pairs.
 * Extracted from the faq template's body, minus the screen concerns (no
 * `flex: 1`, no `ScrollView`, no "still need help" footer) — the host screen
 * owns scrolling.
 *
 * @example
 * ```tsx
 * <FaqSectionBlock
 *   title="Common questions"
 *   items={[{ question: "Is there a free plan?", answer: "Yes — up to 3 projects." }]}
 * />
 * ```
 */
export function FaqSectionBlock({
  eyebrow,
  title = "Common questions",
  description,
  items = DEFAULT_ITEMS,
  style: styleOverride,
}: FaqSectionBlockProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      <SectionHeader
        align="center"
        eyebrow={eyebrow}
        title={title}
        description={description}
        style={styles.header}
      />

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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Module scope, not render time: theme-dependent styles created during render
// miss the SSR head snapshot and paint unstyled. See docs/ssr-hydration.md §7.
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    header: {
      marginBottom: spacing.lg,
    },
    accordion: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 560,
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
  });

const themedStyles = createThemedStyles(createStyles);
