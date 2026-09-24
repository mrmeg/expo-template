import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Toggle } from "../Toggle";
import { useFeedbackStore } from "../../state/feedbackStore";

const mockImpactAsync = jest.fn();
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

describe("Toggle haptics", () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    useFeedbackStore.setState({ haptics: "selection" });
  });

  it("taps on a user toggle under the default setting and forwards the change", async () => {
    const onPressedChange = jest.fn();
    await render(
      <Toggle pressed={false} onPressedChange={onPressedChange} accessibilityLabel="Bold">
        <Text>B</Text>
      </Toggle>,
    );
    await fireEvent.press(screen.getByRole("switch"));
    expect(onPressedChange).toHaveBeenCalledWith(true);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it("stays silent under off", async () => {
    useFeedbackStore.setState({ haptics: "off" });
    await render(
      <Toggle pressed={false} onPressedChange={() => {}} accessibilityLabel="Bold">
        <Text>B</Text>
      </Toggle>,
    );
    await fireEvent.press(screen.getByRole("switch"));
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });
});
