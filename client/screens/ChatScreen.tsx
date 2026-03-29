import React, { useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  Pressable,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "@/client/features/keyboard";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import { SansSerifText } from "@/client/components/ui/StyledText";
import { TextInput } from "@/client/components/ui/TextInput";
import { Icon } from "@/client/components/ui/Icon";
import { Skeleton } from "@/client/components/ui/Skeleton";
import type { Theme } from "@/client/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  isMine: boolean;
  status?: MessageStatus;
  data?: Record<string, unknown>;
}

export interface ChatScreenProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onMessagePress?: (message: ChatMessage) => void;
  placeholder?: string;
  maxInputLength?: number;
  isTyping?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const BUBBLE_RADIUS = spacing.radiusLg;
const BUBBLE_TAIL_RADIUS = 4;
const MAX_BUBBLE_WIDTH = "80%";
const SEND_BUTTON_SIZE = 36;
const TYPING_DOT_SIZE = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

function formatDayLabel(date: Date): string {
  if (isSameDay(date, new Date())) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Determine whether to show the timestamp between two consecutive messages.
 * A timestamp is shown when the sender changes or the gap exceeds 5 minutes.
 */
function shouldShowTimestamp(
  current: ChatMessage,
  previous: ChatMessage | undefined
): boolean {
  if (!previous) return true;
  if (current.isMine !== previous.isMine) return true;
  return (
    current.timestamp.getTime() - previous.timestamp.getTime() >=
    GROUP_THRESHOLD_MS
  );
}

/**
 * Determine whether to show a day separator before this message.
 * Because the FlatList is inverted, "previous" is the message below
 * (i.e. the one that comes later chronologically).
 */
function shouldShowDaySeparator(
  current: ChatMessage,
  previous: ChatMessage | undefined
): boolean {
  if (!previous) return true;
  return !isSameDay(current.timestamp, previous.timestamp);
}

// ---------------------------------------------------------------------------
// Typing Indicator
// ---------------------------------------------------------------------------

function TypingDot({ delay, theme }: { delay: number; theme: Theme }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={{
        width: TYPING_DOT_SIZE,
        height: TYPING_DOT_SIZE,
        borderRadius: TYPING_DOT_SIZE / 2,
        backgroundColor: theme.colors.mutedForeground,
        opacity,
      }}
    />
  );
}

function TypingIndicator({ theme }: { theme: Theme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.receivedRow}>
      <View style={[styles.bubble, styles.receivedBubble, styles.typingBubble]}>
        <TypingDot delay={0} theme={theme} />
        <TypingDot delay={150} theme={theme} />
        <TypingDot delay={300} theme={theme} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status Indicator
// ---------------------------------------------------------------------------

function StatusText({ status, theme }: { status?: MessageStatus; theme: Theme }) {
  const styles = createStyles(theme);
  if (!status) return null;

  switch (status) {
    case "sending":
      return <SansSerifText style={styles.statusText}>Sending...</SansSerifText>;
    case "sent":
      return (
        <View style={styles.statusRow}>
          <Icon name="check" size={11} color={theme.colors.mutedForeground} decorative />
        </View>
      );
    case "delivered":
      return (
        <View style={styles.statusRow}>
          <Icon name="check" size={11} color={theme.colors.mutedForeground} decorative />
          <Icon
            name="check"
            size={11}
            color={theme.colors.mutedForeground}
            style={{ marginLeft: -6 }}
            decorative
          />
        </View>
      );
    case "read":
      return (
        <View style={styles.statusRow}>
          <Icon name="check" size={11} color={theme.colors.accent} decorative />
          <Icon
            name="check"
            size={11}
            color={theme.colors.accent}
            style={{ marginLeft: -6 }}
            decorative
          />
        </View>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton({ theme }: { theme: Theme }) {
  const styles = createStyles(theme);
  const rows = [
    { isMine: false, width: "65%" },
    { isMine: true, width: "55%" },
    { isMine: false, width: "70%" },
    { isMine: true, width: "45%" },
    { isMine: false, width: "60%" },
    { isMine: true, width: "50%" },
  ] as const;

  return (
    <View style={styles.skeletonContainer}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.skeletonRow,
            row.isMine ? styles.sentRow : styles.receivedRow,
          ]}
        >
          <Skeleton
            width={row.width as `${number}%`}
            height={40}
            borderRadius={BUBBLE_RADIUS}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatScreen({
  messages,
  onSend,
  onMessagePress,
  placeholder = "Type a message...",
  maxInputLength,
  isTyping = false,
  loading = false,
  style: styleOverride,
}: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [inputText, setInputText] = React.useState("");
  const canSend = inputText.trim().length > 0;

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputText("");
  }, [inputText, onSend]);

  // Sorted newest-first for inverted FlatList
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [messages]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // In an inverted list index 0 is the newest message.
      // "previous" means the message that appeared before this one in
      // chronological order, which is the next index in the inverted array.
      const prevMessage = sortedMessages[index + 1];
      const showTimestamp = shouldShowTimestamp(item, prevMessage);
      const showDay = shouldShowDaySeparator(item, prevMessage);

      return (
        <View>
          {/* Day separator — rendered above the first message of a new day */}
          {showDay && (
            <View style={styles.daySeparatorRow}>
              <View style={styles.daySeparatorPill}>
                <SansSerifText style={styles.daySeparatorText}>
                  {formatDayLabel(item.timestamp)}
                </SansSerifText>
              </View>
            </View>
          )}

          {/* Timestamp label */}
          {showTimestamp && !showDay && (
            <SansSerifText style={styles.timestampLabel}>
              {formatTime(item.timestamp)}
            </SansSerifText>
          )}

          {/* Bubble */}
          <Pressable
            onPress={onMessagePress ? () => onMessagePress(item) : undefined}
            style={item.isMine ? styles.sentRow : styles.receivedRow}
            accessibilityRole="text"
            accessibilityLabel={`${item.isMine ? "You" : "Received"}: ${item.text}`}
          >
            <View
              style={[
                styles.bubble,
                item.isMine ? styles.sentBubble : styles.receivedBubble,
              ]}
            >
              <SansSerifText
                style={item.isMine ? styles.sentText : styles.receivedText}
              >
                {item.text}
              </SansSerifText>
            </View>
          </Pressable>

          {/* Status indicator for sent messages */}
          {item.isMine && item.status && (
            <View style={styles.statusContainer}>
              <StatusText status={item.status} theme={theme} />
            </View>
          )}
        </View>
      );
    },
    [sortedMessages, onMessagePress, theme, styles]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styleOverride]}>
        <LoadingSkeleton theme={theme} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, styleOverride]}>
      {/* Message list */}
      <FlatList
        data={sortedMessages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.top > 0 ? spacing.sm : spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={isTyping ? <TypingIndicator theme={theme} /> : null}
      />

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            placeholder={placeholder}
            value={inputText}
            onChangeText={setInputText}
            maxLength={maxInputLength}
            multiline
            variant="filled"
            size="md"
            style={styles.input}
            wrapperStyle={styles.inputFlex}
            onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendButton,
              { backgroundColor: canSend ? theme.colors.primary : theme.colors.muted },
            ]}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
          >
            <Icon
              name="arrow-up"
              size={20}
              color={canSend ? theme.colors.primaryForeground : theme.colors.mutedForeground}
              decorative
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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

    // Message list
    listContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },

    // Rows
    sentRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: spacing.xxs,
    },
    receivedRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: spacing.xxs,
    },

    // Bubbles
    bubble: {
      maxWidth: MAX_BUBBLE_WIDTH as any,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm,
    },
    sentBubble: {
      backgroundColor: theme.colors.primary,
      borderRadius: BUBBLE_RADIUS,
      borderBottomRightRadius: BUBBLE_TAIL_RADIUS,
    },
    receivedBubble: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: BUBBLE_RADIUS,
      borderBottomLeftRadius: BUBBLE_TAIL_RADIUS,
    },

    // Bubble text
    sentText: {
      fontSize: 15,
      lineHeight: 21,
      color: theme.colors.primaryForeground,
    },
    receivedText: {
      fontSize: 15,
      lineHeight: 21,
      color: theme.colors.foreground,
    },

    // Timestamp
    timestampLabel: {
      fontSize: 11,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginVertical: spacing.sm,
    },

    // Day separator
    daySeparatorRow: {
      alignItems: "center",
      marginVertical: spacing.md,
    },
    daySeparatorPill: {
      backgroundColor: theme.colors.muted,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusFull,
    },
    daySeparatorText: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },

    // Status
    statusContainer: {
      alignItems: "flex-end",
      marginBottom: spacing.xxs,
      paddingRight: spacing.xs,
    },
    statusText: {
      fontSize: 11,
      color: theme.colors.mutedForeground,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    // Typing indicator
    typingBubble: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm + 2,
    },

    // Input bar
    inputBar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      backgroundColor: theme.colors.background,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
    },
    inputFlex: {
      flex: 1,
    },
    input: {
      maxHeight: 100,
      borderRadius: spacing.radiusXl,
      fontFamily: fontFamilies.sansSerif.regular,
      fontSize: 15,
    },
    sendButton: {
      width: SEND_BUTTON_SIZE,
      height: SEND_BUTTON_SIZE,
      borderRadius: SEND_BUTTON_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Platform.OS === "ios" ? 1 : 0,
    },

    // Skeleton loading
    skeletonContainer: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    skeletonRow: {
      flexDirection: "row",
    },
  });
