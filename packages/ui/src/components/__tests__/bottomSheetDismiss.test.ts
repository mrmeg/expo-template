import { awaitDialogClose } from "../bottomSheetDismiss";

type Listener = () => void;

/** Stand-in for the HTML `<dialog>` @expo/ui's web sheet renders. */
function fakeDialog(open: boolean) {
  const listeners = new Set<Listener>();
  return {
    open,
    addEventListener: jest.fn((_type: "close", listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: jest.fn((_type: "close", listener: Listener) => {
      listeners.delete(listener);
    }),
    close() {
      this.open = false;
      [...listeners].forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

function nodeInside(dialog: ReturnType<typeof fakeDialog> | null) {
  return { closest: jest.fn((selector: string) => (selector === "dialog" ? dialog : null)) };
}

describe("awaitDialogClose (web)", () => {
  it("waits for the enclosing open dialog's close event, then fires once", () => {
    const dialog = fakeDialog(true);
    const callback = jest.fn();

    awaitDialogClose(nodeInside(dialog), callback);

    expect(callback).not.toHaveBeenCalled();
    dialog.close();
    dialog.close();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(dialog.listenerCount()).toBe(0);
  });

  it("fires immediately when the dialog is already closed", () => {
    const dialog = fakeDialog(false);
    const callback = jest.fn();

    awaitDialogClose(nodeInside(dialog), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(dialog.addEventListener).not.toHaveBeenCalled();
  });

  it("fires immediately when no dialog encloses the node, or there is no DOM node", () => {
    const callback = jest.fn();

    awaitDialogClose(nodeInside(null), callback);
    awaitDialogClose(null, callback);
    awaitDialogClose({}, callback);

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("cancel removes the listener so an unmounted sheet never fires", () => {
    const dialog = fakeDialog(true);
    const callback = jest.fn();

    const cancel = awaitDialogClose(nodeInside(dialog), callback);
    cancel();
    dialog.close();

    expect(callback).not.toHaveBeenCalled();
    expect(dialog.listenerCount()).toBe(0);
  });
});
