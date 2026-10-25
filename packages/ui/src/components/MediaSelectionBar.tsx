import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { Theme } from "../constants/colors";
import { spacing } from "../constants/spacing";
import { useTheme } from "../hooks/useTheme";
import { translateText } from "../lib/i18n";
import { createThemedStyles } from "../lib/themedStyles";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import type { IconName } from "./Icon";
import { SansSerifText } from "./StyledText";

export interface MediaSelectionBarProps {
  /** How many items are selected. */
  selectedCount: number;
  /** How many items are on screen to select. */
  totalCount: number;
  /** The select-all checkbox changed: select everything, or clear when everything is selected. */
  onToggleAll: () => void;
  /** The Clear button was pressed. Shown only while something is selected. */
  onClear: () => void;
  /** The Delete button was pressed. It is disabled while nothing is selected. */
  onDelete: () => void;
  /** An action is in flight: disables every control. @default false */
  busy?: boolean;
  /** The delete is the action in flight: also shows the spinner on the Delete button. @default false */
  deleting?: boolean;
  /** Checkbox label while not everything is selected. @default "Select all" */
  selectAllLabel?: string;
  /** Checkbox label while everything is selected. @default "Deselect all" */
  deselectAllLabel?: string;
  /** Summary while something is selected. @default count => `${count} selected` */
  selectedSummary?: (count: number) => string;
  /** Summary while nothing is selected. @default count => `${count} items` */
  totalSummary?: (count: number) => string;
  /** Clear button text. @default "Clear" */
  clearLabel?: string;
  /** Delete button text; gets 0 while nothing is selected. @default count => count > 0 ? `Delete (${count})` : "Delete" */
  deleteLabel?: (count: number) => string;
  /**
   * Glyph on the Delete button. Any registered `Icon` name; the built-in
   * default is `x`, so pass your app's `trash` for a bin.
   * @default "x"
   */
  deleteIcon?: IconName;
  /** Style for the bar (margins, width). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const defaultSelectedSummary = (count: number) =>
  translateText("media.selection.selected", `${count} selected`, { count }) ?? `${count} selected`;
const defaultTotalSummary = (count: number) =>
  translateText("media.selection.items", `${count} items`, { count }) ?? `${count} items`;
const defaultDeleteLabel = (count: number) =>
  count > 0
    ? (translateText("media.selection.deleteCount", `Delete (${count})`, { count }) ?? `Delete (${count})`)
    : (translateText("media.selection.delete", "Delete") ?? "Delete");

const DELETE_ICON_SIZE = 14;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // A flat toolbar row with a hairline under it, not a panel.
    bar: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    summary: {
      flex: 1,
      color: theme.colors.mutedForeground,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
  });

/** Registered at module scope so web server rendering serializes them (see `docs/server-guide.md`). */
const themedStyles = /*#__PURE__*/ createThemedStyles(createStyles);

/** Inset between the Delete button's glyph and its text. */
const deleteTextStyle = /*#__PURE__*/ StyleSheet.create({ text: { marginLeft: spacing.xs } }).text;

/**
 * MediaSelectionBar
 *
 * The toolbar over a media grid: a select-all checkbox (indeterminate while
 * only some items are selected), a "3 selected" or "12 items" summary, a Clear
 * button once anything is selected, and a destructive Delete button that shows
 * the count and a spinner while the delete runs. A flat row with a hairline
 * under it, not a panel. Presentational: pair it with `useKeySelection`.
 *
 * Put it in the same capped column as the grid (`MediaGrid`'s `maxWidth`), and
 * confirm the delete in your own dialog from `onDelete`.
 *
 * Subpath-only with the other media components:
 * `@mrmeg/expo-ui/components/MediaSelectionBar`.
 *
 * @example
 * ```tsx
 * <MediaSelectionBar
 *   selectedCount={selection.count}
 *   totalCount={keys.length}
 *   onToggleAll={selection.toggleAll}
 *   onClear={selection.clear}
 *   onDelete={confirmDelete}
 *   busy={isDeleting}
 *   deleting={isDeleting}
 * />
 * ```
 */
export function MediaSelectionBar({
  selectedCount,
  totalCount,
  onToggleAll,
  onClear,
  onDelete,
  busy = false,
  deleting = false,
  selectAllLabel = translateText("media.selection.selectAll", "Select all") ?? "Select all",
  deselectAllLabel = translateText("media.selection.deselectAll", "Deselect all") ?? "Deselect all",
  selectedSummary = defaultSelectedSummary,
  totalSummary = defaultTotalSummary,
  clearLabel = translateText("media.selection.clear", "Clear") ?? "Clear",
  deleteLabel = defaultDeleteLabel,
  deleteIcon = "x",
  style,
  testID,
}: MediaSelectionBarProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const allSelected = totalCount > 0 && selectedCount >= totalCount;
  const someSelected = selectedCount > 0 && !allSelected;
  const hasSelection = selectedCount > 0;

  return (
    <View style={[styles.bar, style]} testID={testID}>
      <Checkbox
        // A partial selection is unchecked + indeterminate: the dash, read as
        // "mixed"; pressing it selects everything.
        checked={allSelected}
        indeterminate={someSelected}
        onCheckedChange={onToggleAll}
        disabled={busy || totalCount === 0}
        label={allSelected ? deselectAllLabel : selectAllLabel}
      />
      <SansSerifText size="sm" style={styles.summary}>
        {hasSelection ? selectedSummary(selectedCount) : totalSummary(totalCount)}
      </SansSerifText>
      <View style={styles.actions}>
        {hasSelection ? <Button preset="ghost" size="sm" text={clearLabel} onPress={onClear} disabled={busy} /> : null}
        <Button
          preset="destructive"
          size="sm"
          onPress={onDelete}
          disabled={!hasSelection || busy}
          loading={deleting}
        >
          <Button.Icon name={deleteIcon} size={DELETE_ICON_SIZE} />
          <Button.Text style={deleteTextStyle}>{deleteLabel(selectedCount)}</Button.Text>
        </Button>
      </View>
    </View>
  );
}
