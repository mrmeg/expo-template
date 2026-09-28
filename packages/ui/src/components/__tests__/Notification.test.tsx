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
