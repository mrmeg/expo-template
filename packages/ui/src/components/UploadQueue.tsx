import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { Theme } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { useTheme } from "../hooks/useTheme";
import { translateText } from "../lib/i18n";
import { createThemedStyles } from "../lib/themedStyles";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Image } from "./Image";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "./Item";
import { Progress } from "./Progress";
import { EyebrowText } from "./StyledText";

/** Where an upload is in its life. `processing` is on-device work before the bytes go out. */
export type UploadQueueStatus = "queued" | "processing" | "uploading" | "done" | "failed";

/**
 * One upload. A media package's queue items satisfy it structurally, so pass
 * them as they are.
 */
export interface UploadQueueEntry {
  /** Unique and stable; passed back to `onRetry` and `onRemove`. */
  id: string;
  fileName: string;
  kind: "image" | "video";
  status: UploadQueueStatus;
  /** A local thumbnail to show beside the name. */
  previewUri?: string;
  /** 0 to 1 when known (video conversion, for example). Without it the bar is indeterminate. */
  progress?: number;
  /** Processing sub-phase: `"decoding-heic"`, `"compressing"`, `"converting-video"`, `"extracting-thumbnail"`, and so on. */
  phase?: string;
  /** Why a `failed` entry failed. Shown as its status text. */
  errorMessage?: string;
}

/** Builds a screen-reader label from a file name. */
export type UploadQueueLabel = (fileName: string) => string;

export interface UploadQueueProps {
  /** The uploads, in the order to show them. Renders nothing when empty. */
  entries: readonly UploadQueueEntry[];
  /** Renders a retry button on failed rows, only when set. */
  onRetry?: (id: string) => void;
  /** Renders a remove button on queued, failed and done rows, only when set. */
  onRemove?: (id: string) => void;
  /** Section header text, an uppercase eyebrow announced as a header. */
  title?: string;
  /** Header action, shown only when set and at least one entry is done or failed. */
  onClearFinished?: () => void;
  /** The text under a file name. @default uploadQueueStatusLabel */
  statusLabel?: (entry: UploadQueueEntry) => string;
  /** Label for a failed row's retry button. @default fileName => `Retry ${fileName}` */
  retryLabel?: UploadQueueLabel;
  /** Label for a row's remove button. @default fileName => `Remove ${fileName}` */
  removeLabel?: UploadQueueLabel;
  /** Text of the header action. @default "Clear finished" */
  clearFinishedLabel?: string;
  /**
   * Most rows to draw. The rest are summed up in a footer line, so a large
   * pick cannot push the screen's content out of view; rows move up as
   * earlier ones are removed. Unset draws every entry.
   */
  maxVisible?: number;
  /** The footer line for the hidden rows. @default count => `${count} more` */
  moreLabel?: (count: number) => string;
  /**
   * Glyph beside a name that has no `previewUri`. Any registered `Icon` name;
   * the built-in defaults are `image-off` for an image and `play` for a video,
   * so pass your app's `image` and `video` for something closer.
   */
  kindIcons?: Partial<Record<UploadQueueEntry["kind"], IconName>>;
  /** Style for the outer container (margins). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const t = (key: string, fallback: string, options?: object) => translateText(key, fallback, options) ?? fallback;

/**
 * The default status text: "Waiting", "Optimizing…", "Converting 42%",
 * "Uploading…", "Uploaded", the entry's `errorMessage` or "Failed". Every
 * string goes through `translateText` (`media.queue.*`). Wrap it to change one
 * state and keep the rest.
 */
export function uploadQueueStatusLabel(entry: UploadQueueEntry): string {
  switch (entry.status) {
    case "queued":
      return t("media.queue.waiting", "Waiting");
    case "processing":
      if (entry.phase === "converting-video") {
        const percent = progressPercent(entry.progress);
        return percent === undefined
          ? t("media.queue.converting", "Converting…")
          : t("media.queue.convertingPercent", `Converting ${percent}%`, { percent });
      }
      return t("media.queue.optimizing", "Optimizing…");
    case "uploading":
      return t("media.queue.uploading", "Uploading…");
    case "done":
      return t("media.queue.done", "Uploaded");
    case "failed":
      return entry.errorMessage || t("media.queue.failed", "Failed");
  }
}

/** `progress` as a whole percent, or `undefined` when it is not a number. */
function progressPercent(progress: number | undefined): number | undefined {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return undefined;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

const defaultRetryLabel: UploadQueueLabel = (fileName) =>
  t("media.queue.retryTitle", `Retry ${fileName}`, { name: fileName });
const defaultRemoveLabel: UploadQueueLabel = (fileName) =>
  t("media.queue.removeTitle", `Remove ${fileName}`, { name: fileName });

const defaultMoreLabel = (count: number) => t("media.queue.more", `${count} more`, { count });

const DEFAULT_KIND_ICONS: Record<UploadQueueEntry["kind"], IconName> = {
  image: "image-off",
  video: "play",
};

const PREVIEW_SIZE = 40;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.rowPaddingX,
      paddingBottom: spacing.xs,
    },
    headerTitle: {
      flex: 1,
    },
    title: {
      color: theme.colors.mutedForeground,
    },
    // The name, preview and status are one accessible element; the buttons stay outside it.
    info: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.rowGap,
    },
    preview: {
      width: PREVIEW_SIZE,
      height: PREVIEW_SIZE,
    },
    failedText: {
      color: theme.colors.destructive,
    },
    bar: {
      marginTop: spacing.xs,
    },
    // Each `sm` IconButton's hit slop reaches 8 pt past its edge, so adjacent
    // buttons need a 16 pt gap for their hit areas not to overlap.
    actions: {
      gap: spacing.md,
    },
  });

/** Registered at module scope so web server rendering serializes them (see `docs/server-guide.md`). */
const themedStyles = /*#__PURE__*/ createThemedStyles(createStyles);

interface UploadQueueRowProps {
  entry: UploadQueueEntry;
  statusLabel: (entry: UploadQueueEntry) => string;
  retryLabel: UploadQueueLabel;
  removeLabel: UploadQueueLabel;
  kindIcons: Partial<Record<UploadQueueEntry["kind"], IconName>> | undefined;
  onRetry: ((id: string) => void) | undefined;
  onRemove: ((id: string) => void) | undefined;
  testID: string | undefined;
}

function UploadQueueRow({
  entry,
  statusLabel,
  retryLabel,
  removeLabel,
  kindIcons,
  onRetry,
  onRemove,
  testID,
}: UploadQueueRowProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { id, fileName, kind, status, previewUri, progress } = entry;
  const statusText = statusLabel(entry);
  const active = status === "processing" || status === "uploading";
  const percent = progressPercent(progress);
  const canRetry = status === "failed" && !!onRetry;
  const canRemove = status !== "processing" && status !== "uploading" && !!onRemove;
  // A row that moves to done or failed is announced once. Progress ticks and
  // the first render are not: a live region would read every update.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current !== status && (status === "done" || status === "failed")) {
      AccessibilityInfo.announceForAccessibility(`${fileName}, ${statusText}`);
    }
    previousStatus.current = status;
  }, [status, fileName, statusText]);

  return (
    <Item testID={testID}>
      {/* A static `Item` is not an accessible element, so the label sits on the wrapper around the name and status. */}
      <View accessible accessibilityLabel={`${fileName}, ${statusText}`} style={styles.info}>
        <ItemMedia size={PREVIEW_SIZE} icon={kindIcons?.[kind] ?? DEFAULT_KIND_ICONS[kind]}>
          {previewUri ? <Image source={{ uri: previewUri }} alt="" fit="cover" radius="md" style={styles.preview} /> : undefined}
        </ItemMedia>
        <ItemContent>
          <ItemTitle numberOfLines={1}>{fileName}</ItemTitle>
          <ItemDescription numberOfLines={1} style={status === "failed" ? styles.failedText : undefined}>
            {statusText}
          </ItemDescription>
          {active ? (
            <Progress size="sm" value={percent} style={styles.bar} />
          ) : null}
        </ItemContent>
      </View>
      {canRetry || canRemove ? (
        <ItemActions style={styles.actions}>
          {canRetry ? (
            <IconButton
              icon="rotate-ccw"
              size="sm"
              accessibilityLabel={retryLabel(fileName)}
              onPress={() => onRetry?.(id)}
            />
          ) : null}
          {canRemove ? (
            <IconButton icon="x" size="sm" accessibilityLabel={removeLabel(fileName)} onPress={() => onRemove?.(id)} />
          ) : null}
        </ItemActions>
      ) : null}
    </Item>
  );
}

/**
 * UploadQueue
 *
 * The uploads in progress, as a flat list: one `Item` row per entry in an
 * `ItemGroup`, with a small preview (or a kind icon), the file name, a status
 * line, and a `Progress` bar while it processes or uploads. The bar is
 * determinate when the entry's `progress` (0 to 1) is a number and
 * indeterminate otherwise. Failed rows can offer retry, and rows that are not
 * mid-flight can offer remove; both buttons exist only when their handler does.
 *
 * Each row is one screen-reader element reading "file name, status". A row
 * that moves to done or failed is announced once with
 * `AccessibilityInfo.announceForAccessibility`; progress ticks and the first
 * render are not. Presentational: it holds no queue state, and `UploadQueueEntry` is
 * satisfied structurally by the media package's queue items.
 *
 * Subpath-only, like the `Image` it draws previews with: import it from
 * `@mrmeg/expo-ui/components/UploadQueue`, and install `expo-image`.
 *
 * @example
 * ```tsx
 * <UploadQueue
 *   title="Uploading"
 *   entries={queue.items}
 *   onRetry={queue.retry}
 *   onRemove={queue.remove}
 *   onClearFinished={queue.clearFinished}
 * />
 * ```
 */
export function UploadQueue({
  entries,
  onRetry,
  onRemove,
  title,
  onClearFinished,
  statusLabel = uploadQueueStatusLabel,
  retryLabel = defaultRetryLabel,
  removeLabel = defaultRemoveLabel,
  clearFinishedLabel,
  maxVisible,
  moreLabel = defaultMoreLabel,
  kindIcons,
  style,
  testID,
}: UploadQueueProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  if (entries.length === 0) return null;

  const hasFinished = entries.some((entry) => entry.status === "done" || entry.status === "failed");
  const showClear = !!onClearFinished && hasFinished;
  const limit = maxVisible === undefined ? entries.length : Math.max(0, Math.floor(maxVisible));
  const visible = entries.length > limit ? entries.slice(0, limit) : entries;
  const hidden = entries.length - visible.length;
  // react-native-web renders an unlevelled header as h1; level it as h2 there,
  // as `ItemGroup` does.
  const headingLevel = Platform.OS === "web" ? { "aria-level": 2 } : undefined;

  return (
    <View style={style} testID={testID}>
      {title || showClear ? (
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            {title ? (
              <EyebrowText accessibilityRole="header" {...headingLevel} style={styles.title}>
                {title}
              </EyebrowText>
            ) : null}
          </View>
          {showClear ? (
            <Button
              preset="ghost"
              size="sm"
              text={clearFinishedLabel ?? t("media.queue.clearFinished", "Clear finished")}
              onPress={onClearFinished}
            />
          ) : null}
        </View>
      ) : null}
      <ItemGroup footer={hidden > 0 ? moreLabel(hidden) : undefined}>
        {visible.map((entry) => (
          <UploadQueueRow
            key={entry.id}
            entry={entry}
            statusLabel={statusLabel}
            retryLabel={retryLabel}
            removeLabel={removeLabel}
            kindIcons={kindIcons}
            onRetry={onRetry}
            onRemove={onRemove}
            testID={testID ? `${testID}-${entry.id}` : undefined}
          />
        ))}
      </ItemGroup>
    </View>
  );
}
