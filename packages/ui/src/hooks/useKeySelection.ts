import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMPTY: ReadonlySet<string> = new Set<string>();

/** What `useKeySelection` returns. */
export interface KeySelection {
  /** The selected keys that are still visible. A new Set only when the selection changes. */
  selected: ReadonlySet<string>;
  /** How many keys are selected. */
  count: number;
  /**
   * Whether `key` is selected. Reads the current selection, so its identity
   * changes with `selected`; hand tiles the boolean, not this function.
   */
  isSelected: (key: string) => boolean;
  /** Select `key`, or deselect it when it is already selected. Stable. */
  toggle: (key: string) => void;
  /** Select every visible key, or clear the selection when every one is already selected. Stable. */
  toggleAll: () => void;
  /** Deselect everything. Stable. */
  clear: () => void;
  /** Deselect these keys, for example once they are deleted. Stable. */
  remove: (keys: readonly string[]) => void;
  /** Every visible key is selected (false when nothing is visible). */
  allSelected: boolean;
  /** Some, but not every, visible key is selected: the indeterminate state of a select-all checkbox. */
  someSelected: boolean;
}

/** `selection` without the keys `visible` no longer holds; the same Set when nothing was dropped. */
function prune(selection: ReadonlySet<string>, visible: ReadonlySet<string>): ReadonlySet<string> {
  if (selection.size === 0) return selection;
  const kept = new Set<string>();
  for (const key of selection) if (visible.has(key)) kept.add(key);
  return kept.size === selection.size ? selection : kept;
}

/**
 * Multi-select state over a list of string keys.
 *
 * Pass the keys currently on screen (a filtered or paged list). A selected
 * key that leaves `visibleKeys` stops counting at once (it is pruned from
 * `selected`, `count`, `allSelected` and `someSelected`) and is dropped for
 * good on the next change, so deleting items or switching a filter never
 * leaves a hidden selection behind to be acted on by mistake.
 *
 * `toggle`, `toggleAll`, `clear` and `remove` keep their identity across
 * renders, so memoized tiles that receive them skip re-rendering. `selected`
 * keeps its identity until the selection actually changes.
 *
 * It knows nothing about what the keys name, so it works for any list.
 *
 * ```tsx
 * const keys = useMemo(() => items.map((item) => item.id), [items]);
 * const selection = useKeySelection(keys);
 * <MediaSelectionBar
 *   selectedCount={selection.count}
 *   totalCount={keys.length}
 *   onToggleAll={selection.toggleAll}
 *   onClear={selection.clear}
 *   onDelete={() => deleteItems([...selection.selected])}
 * />
 * ```
 */
export function useKeySelection(visibleKeys: readonly string[]): KeySelection {
  const [candidates, setCandidates] = useState<ReadonlySet<string>>(EMPTY);
  const visible = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const selected = useMemo(() => prune(candidates, visible), [candidates, visible]);

  // The callbacks read the latest visible set through a ref so they can stay
  // stable. They only run from events, after the effect below has synced it.
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const toggle = useCallback((key: string) => {
    setCandidates((previous) => {
      const next = new Set(prune(previous, visibleRef.current));
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCandidates((previous) => {
      const current = prune(previous, visibleRef.current);
      const everyVisible = visibleRef.current.size > 0 && current.size === visibleRef.current.size;
      return everyVisible || visibleRef.current.size === 0 ? EMPTY : new Set(visibleRef.current);
    });
  }, []);

  const clear = useCallback(() => {
    setCandidates((previous) => (previous.size === 0 ? previous : EMPTY));
  }, []);

  const remove = useCallback((keys: readonly string[]) => {
    setCandidates((previous) => {
      const next = new Set(prune(previous, visibleRef.current));
      let changed = next.size !== previous.size;
      for (const key of keys) changed = next.delete(key) || changed;
      return changed ? next : previous;
    });
  }, []);

  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  const allSelected = visible.size > 0 && selected.size === visible.size;
  const someSelected = selected.size > 0 && !allSelected;

  return { selected, count: selected.size, isSelected, toggle, toggleAll, clear, remove, allSelected, someSelected };
}
