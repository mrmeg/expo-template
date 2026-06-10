import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { globalUIStore } from "../../state/globalUIStore";
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
