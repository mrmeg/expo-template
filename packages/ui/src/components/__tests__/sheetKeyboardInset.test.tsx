import React from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { keyboardOverlap, useSheetKeyboardInset } from "../sheetKeyboardInset";

type KeyboardListener = (event?: unknown) => void;

/** The RN jest View mock shares one `measureInWindow` jest.fn across instances. */
const measureInWindow = (View.prototype as unknown as { measureInWindow: jest.Mock })
  .measureInWindow;

function Harness({ enabled = true, absorbedInset = 34 }: { enabled?: boolean; absorbedInset?: number }) {
  const { columnRef, onLayout, paddingBottom } = useSheetKeyboardInset({ enabled, absorbedInset });
  return <View testID="column" ref={columnRef} onLayout={onLayout} style={{ paddingBottom }} />;
}

function columnPadding() {
  return (StyleSheet.flatten(screen.getByTestId("column").props.style) as { paddingBottom: number })
    .paddingBottom;
}

/** Flip Platform.OS for one render, restoring it afterwards (as BottomSheet.test.tsx does). */
async function withPlatform<T>(os: string, run: () => Promise<T>) {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  try {
    return await run();
  } finally {
    Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
  }
}

describe("keyboardOverlap", () => {
  it("is the covered height net of the inset the column already pads", () => {
    expect(keyboardOverlap(800, 500, 34)).toBe(266);
  });

  it("is 0 when the keyboard sits below the column", () => {
    expect(keyboardOverlap(800, 900, 34)).toBe(0);
  });

  it("is 0 when the absorbed inset already clears the overlap", () => {
    expect(keyboardOverlap(800, 780, 34)).toBe(0);
  });
});

describe("useSheetKeyboardInset", () => {
  let addListener: jest.SpyInstance;
  let removed: jest.Mock;

  function listenerFor(event: string): KeyboardListener {
    const call = addListener.mock.calls.find(([name]) => name === event);
    if (!call) throw new Error(`no ${event} listener`);
    return call[1] as KeyboardListener;
  }

  beforeEach(() => {
    removed = jest.fn();
    addListener = jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation(() => ({ remove: removed }) as never);
    // Column at y=300, 500 tall → bottom 800 in the sheet window.
    measureInWindow.mockImplementation((cb: (...args: number[]) => void) => cb(0, 300, 390, 500));
  });

  afterEach(() => {
    addListener.mockRestore();
    measureInWindow.mockReset();
  });

  it("subscribes to frame and hide events on iOS and pads by the measured overlap", async () => {
    await render(<Harness />);

    expect(addListener).toHaveBeenCalledWith("keyboardDidChangeFrame", expect.any(Function));
    expect(addListener).toHaveBeenCalledWith("keyboardDidHide", expect.any(Function));
    expect(columnPadding()).toBe(0);

    await act(async () => {
      listenerFor("keyboardDidChangeFrame")({ endCoordinates: { screenY: 600 } });
    });

    // 800 (column bottom) - 600 (keyboard top) - 34 (absorbed inset) = 166
    expect(columnPadding()).toBe(166);
  });

  it("re-measures on layout so a host the platform shrank drops the inset", async () => {
    await render(<Harness />);
    await act(async () => {
      listenerFor("keyboardDidChangeFrame")({ endCoordinates: { screenY: 600 } });
    });
    expect(columnPadding()).toBe(166);

    // SwiftUI shrank the host: the column now ends at 566, above the keyboard.
    measureInWindow.mockImplementation((cb: (...args: number[]) => void) => cb(0, 300, 390, 266));
    await fireEvent(screen.getByTestId("column"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 266 } },
    });

    expect(columnPadding()).toBe(0);
  });

  it("clears the inset when the keyboard hides", async () => {
    await render(<Harness />);
    await act(async () => {
      listenerFor("keyboardDidChangeFrame")({ endCoordinates: { screenY: 600 } });
    });
    expect(columnPadding()).toBe(166);

    await act(async () => {
      listenerFor("keyboardDidHide")();
    });

    expect(columnPadding()).toBe(0);
  });

  it("subscribes to nothing when disabled", async () => {
    await render(<Harness enabled={false} />);

    expect(addListener).not.toHaveBeenCalled();
    expect(measureInWindow).not.toHaveBeenCalled();
    expect(columnPadding()).toBe(0);
  });

  it("subscribes to nothing on Android", async () => {
    await withPlatform("android", async () => {
      await render(<Harness />);

      expect(addListener).not.toHaveBeenCalled();
      expect(columnPadding()).toBe(0);

      await fireEvent(screen.getByTestId("column"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 500 } },
      });
      expect(measureInWindow).not.toHaveBeenCalled();
    });
  });

  it("removes both subscriptions on unmount", async () => {
    const { unmount } = await render(<Harness />);
    expect(addListener).toHaveBeenCalledTimes(2);

    await unmount();

    expect(removed).toHaveBeenCalledTimes(2);
  });
});
