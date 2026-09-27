import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { globalUIStore } from "../../state/globalUIStore";
import { spacing } from "../../constants/spacing";
import { Notification } from "../Notification";

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
  // The Animated.View carries the role but is not an accessibility element, so
  // RNTL's role query skips it; find the host view by its props instead.
  const containerStyle = () => {
    const nodes = screen.UNSAFE_root.findAllByProps({ accessibilityRole: "alert" });
    const host = nodes.find((node) => typeof node.type === "string") ?? nodes[0];
    return StyleSheet.flatten(host.props.style) as Record<string, unknown>;
  };

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
