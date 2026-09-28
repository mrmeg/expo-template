/**
 * Dismiss-complete detection for `BottomSheet.onDismissed` on web.
 *
 * `@expo/ui`'s web sheet is an HTML `<dialog>`. When the sheet's `index` goes
 * to -1 it fires `onClose` synchronously, then plays its exit animation and
 * calls `dialog.close()` on `animationend` (a 400 ms fallback timer covers a
 * missed event; `prefers-reduced-motion` closes at once). The hosted RN column
 * is a descendant of that element and stays mounted through the exit, so the
 * element's standard `close` event is the moment the sheet is gone. iOS and
 * Android need none of this: there `@expo/ui`'s close callback is already
 * post-dismissal (see `BottomSheet.tsx`).
 */

/** The subset of `HTMLDialogElement` used here, typed structurally so the package needs no DOM lib. */
type DialogLike = {
  open: boolean;
  addEventListener(type: "close", listener: () => void): void;
  removeEventListener(type: "close", listener: () => void): void;
};

function findEnclosingDialog(node: unknown): DialogLike | null {
  const closest = (node as { closest?: (selector: string) => unknown } | null | undefined)
    ?.closest;
  if (typeof closest !== "function") return null;
  const dialog = closest.call(node, "dialog") as Partial<DialogLike> | null | undefined;
  if (
    !dialog ||
    typeof dialog.addEventListener !== "function" ||
    typeof dialog.removeEventListener !== "function"
  ) {
    return null;
  }
  return dialog as DialogLike;
}

/**
 * Call `callback` once the `<dialog>` enclosing `node` has closed. Fires on the
 * same tick when there is no enclosing dialog (or no DOM node) or the dialog
 * is already closed. Returns a cancel function that removes the pending
 * listener without firing.
 */
export function awaitDialogClose(node: unknown, callback: () => void): () => void {
  const dialog = findEnclosingDialog(node);
  if (!dialog || !dialog.open) {
    callback();
    return () => {};
  }
  const onClose = () => {
    dialog.removeEventListener("close", onClose);
    callback();
  };
  dialog.addEventListener("close", onClose);
  return () => dialog.removeEventListener("close", onClose);
}
