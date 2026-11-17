import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { globalUIStore } from "../../state/globalUIStore";
import { spacing } from "../../constants/spacing";
import { Notification } from "../Notification";
import { useNotificationOffset } from "../../hooks/useNotificationOffset";

jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => true,
}));

describe("Notification", () => {
  afterEach(async () => {
    cleanup();
    globalUIStore.setState({ alert: null });
  });

  it("renders the action label when present", async () => {
    await act(() => {
      globalUIStore.getState().show({
        type: "info",
        title: "Upload failed",
        messages: ["Try again when you are back online."],
        action: {
          label: "Retry",
          onPress: jest.fn(),
        },
      });
    });

    await render(<Notification />);

    expect(screen.getByText("Upload failed")).toBeTruthy();
    expect(screen.getByText("Try again when you are back online.")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("calls the action handler and hides the notification when pressed", async () => {
    const onPress = jest.fn();

    await act(() => {
      globalUIStore.getState().show({
        type: "warning",
        title: "Sync paused",
        messages: ["Reconnect to keep syncing."],
        action: {
          label: "Reconnect",
          onPress,
        },
      });
    });

    await render(<Notification />);

    await act(() => {
      fireEvent.press(screen.getByText("Reconnect"));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(globalUIStore.getState().alert).toBeNull();
    expect(screen.queryByText("Reconnect")).toBeNull();
  });

  it("renders normally without an action", async () => {
    await act(() => {
      globalUIStore.getState().show({
        type: "success",
        title: "Saved",
        messages: ["Your changes are live."],
      });
    });

    await render(<Notification />);

    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("Your changes are live.")).toBeTruthy();
    expect(screen.queryByText("Retry")).toBeNull();
  });
});

describe("Notification content", () => {
  afterEach(async () => {
    cleanup();
    globalUIStore.setState({ alert: null });
  });

  it("shows a message-only notification as the title, with no generic title above it", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "success", messages: ["Profile updated"] });
    });
    await render(<Notification />);

    expect(screen.getByText("Profile updated")).toBeTruthy();
    expect(screen.queryByText("Success")).toBeNull();
  });

  it("falls back to the type's title when there is neither a title nor a message", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "warning", messages: ["  "] });
    });
    await render(<Notification />);

    expect(screen.getByText("Warning")).toBeTruthy();
  });

  it("interrupts for an error and waits its turn for everything else", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "error", title: "Upload failed" });
    });
    await render(<Notification />);
    expect(screen.getByTestId("ui-notification").props.role).toBe("alert");
    expect(screen.getByTestId("ui-notification").props.accessibilityLiveRegion).toBe("assertive");

    await act(() => {
      globalUIStore.getState().show({ type: "success", title: "Saved" });
    });
    expect(screen.getByTestId("ui-notification").props.role).toBe("status");
    expect(screen.getByTestId("ui-notification").props.accessibilityLiveRegion).toBe("polite");
  });

  it("has no close button while it dismisses itself, and one when it is persistent", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "success", title: "Saved" });
    });
    await render(<Notification />);
    expect(screen.queryByLabelText("Dismiss")).toBeNull();

    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Offline", duration: 0 });
    });
    await act(() => {
      fireEvent.press(screen.getByLabelText("Dismiss"));
    });
    expect(globalUIStore.getState().alert).toBeNull();

    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Uploading", loading: true });
    });
    expect(screen.getByLabelText("Dismiss")).toBeTruthy();
  });
});

describe("Notification swipe to dismiss", () => {
  afterEach(async () => {
    cleanup();
    globalUIStore.setState({ alert: null });
  });

  /**
   * Drag one finger vertically through the given offsets, the way the
   * responder system would call the container's handlers. Returns whether the
   * toast claimed the gesture. PanResponder measures the drag from the move
   * that claimed it, so the first offset only starts the gesture.
   */
  async function drag(offsets: number[]) {
    const target = () => screen.getByTestId("ui-notification").props;
    const startY = 100;
    let time = 1000;
    let y = startY;
    let previousY = y;
    let previousTime = time;
    const event = (active: boolean) => ({
      touchHistory: {
        touchBank: [{
          touchActive: active,
          startPageX: 50,
          startPageY: startY,
          startTimeStamp: 1000,
          currentPageX: 50,
          currentPageY: y,
          currentTimeStamp: time,
          previousPageX: 50,
          previousPageY: previousY,
          previousTimeStamp: previousTime,
        }],
        numberActiveTouches: active ? 1 : 0,
        indexOfSingleActiveTouch: active ? 0 : -1,
        mostRecentTimeStamp: time,
      },
      nativeEvent: { touches: active ? [{ identifier: 0, pageX: 50, pageY: y }] : [], changedTouches: [] },
      persist: () => {},
    });

    await act(async () => {
      target().onStartShouldSetResponderCapture(event(true));
    });
    let claimed = false;
    for (const offset of offsets) {
      previousY = y;
      previousTime = time;
      y = startY + offset;
      time += 100;
      await act(async () => {
        if (claimed) {
          target().onResponderMove(event(true));
          return;
        }
        // The capture phase is where PanResponder accumulates the movement.
        target().onMoveShouldSetResponderCapture(event(true));
        if (target().onMoveShouldSetResponder(event(true))) {
          claimed = true;
          target().onResponderGrant(event(true));
        }
      });
    }
    time += 100;
    if (claimed) {
      await act(async () => {
        target().onResponderRelease(event(false));
      });
    }
    return claimed;
  }

  it("dismisses a top banner swiped up", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Top" });
    });
    await render(<Notification />);

    expect(await drag([-20, -40, -60])).toBe(true);
    expect(globalUIStore.getState().alert).toBeNull();
  });

  it("dismisses a bottom toast swiped down", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Bottom", position: "bottom" });
    });
    await render(<Notification />);

    expect(await drag([20, 40, 60])).toBe(true);
    expect(globalUIStore.getState().alert).toBeNull();
  });

  it("keeps a toast that was only nudged", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Top" });
    });
    await render(<Notification />);

    expect(await drag([-8, -10])).toBe(true);
    expect(globalUIStore.getState().alert?.title).toBe("Top");
  });

  it("ignores a drag away from the toast's edge", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Top" });
    });
    await render(<Notification />);

    expect(await drag([20, 40])).toBe(false);
    expect(globalUIStore.getState().alert?.title).toBe("Top");
  });
});

describe("Notification placement", () => {
  const ISLAND = { top: 59, bottom: 34, left: 0, right: 0 };
  const containerStyle = () =>
    StyleSheet.flatten(screen.getByTestId("ui-notification").props.style) as Record<string, unknown>;

  afterEach(async () => {
    cleanup();
    globalUIStore.setState({ alert: null });
  });

  it("sits 8pt below the Dynamic Island inset for a top toast", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Top" });
    });
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().top).toBe(59 + spacing.sm);
  });

  it("sits 8pt above the home indicator for a bottom toast", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Bottom", position: "bottom" });
    });
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().bottom).toBe(34 + spacing.sm);
  });

  function RegisterOffset({ offset }: { offset: { top?: number; bottom?: number } | null }) {
    useNotificationOffset(offset);
    return null;
  }

  it("sits 8pt above a registered bottom offset (a tab bar) instead of the inset", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Bottom", position: "bottom" });
    });
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <RegisterOffset offset={{ bottom: 83 }} />
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().bottom).toBe(83 + spacing.sm);
  });

  it("sits 8pt below a registered top offset", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Top" });
    });
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <RegisterOffset offset={{ top: 100 }} />
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().top).toBe(100 + spacing.sm);
  });

  it("keeps the inset when the registered offset is smaller, and the largest registrant wins", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Bottom", position: "bottom" });
    });
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <RegisterOffset offset={{ bottom: 20 }} />
        <RegisterOffset offset={{ bottom: 60 }} />
        <RegisterOffset offset={{ bottom: 40 }} />
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().bottom).toBe(60 + spacing.sm);
  });

  it("drops the offset when the registering screen unmounts or passes null", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Bottom", position: "bottom" });
    });
    const { rerender } = await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <RegisterOffset offset={{ bottom: 83 }} />
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().bottom).toBe(83 + spacing.sm);

    await rerender(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <RegisterOffset offset={null} />
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().bottom).toBe(34 + spacing.sm);

    await rerender(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().bottom).toBe(34 + spacing.sm);
    expect(globalUIStore.getState().notificationOffsets).toEqual({});
  });

  it("keeps 20pt from the edge when no inset is known (no provider, web)", async () => {
    await act(() => {
      globalUIStore.getState().show({ type: "info", title: "Plain" });
    });
    await render(
      <SafeAreaInsetsContext.Provider value={null}>
        <Notification />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(containerStyle().top).toBe(20);
  });
});
