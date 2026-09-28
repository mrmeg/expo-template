/**
 * Button haptics follow the provider setting: silent by default, a light tap
 * on press-in under `"all"`, and the `haptic` prop forces either way.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "../Button";
import { useFeedbackStore } from "../../state/feedbackStore";

const mockImpactAsync = jest.fn();
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

async function pressIn(label: string) {
  await fireEvent(screen.getByRole("button", { name: label }), "pressIn", { nativeEvent: {} });
}

describe("Button haptics", () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    useFeedbackStore.setState({ haptics: "selection" });
  });

  it("is silent under the default selection setting", async () => {
    await render(<Button text="Save" onPress={() => {}} />);
    await pressIn("Save");
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it("taps on press-in under the all setting", async () => {
    useFeedbackStore.setState({ haptics: "all" });
    await render(<Button text="Save" onPress={() => {}} />);
    await pressIn("Save");
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it("haptic prop forces on and off regardless of the setting", async () => {
    await render(<Button text="Forced" haptic onPress={() => {}} />);
    await pressIn("Forced");
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    useFeedbackStore.setState({ haptics: "all" });
    await render(<Button text="Muted" haptic={false} onPress={() => {}} />);
    await pressIn("Muted");
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it("does not tap while disabled", async () => {
    useFeedbackStore.setState({ haptics: "all" });
    await render(<Button text="Off" disabled onPress={() => {}} />);
    await pressIn("Off");
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it("does not tap while announced disabled (aria-disabled), though the press still fires", async () => {
    useFeedbackStore.setState({ haptics: "all" });
    const onPress = jest.fn();
    await render(<Button text="Publish" aria-disabled onPress={onPress} />);
    await pressIn("Publish");
    expect(mockImpactAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Publish"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
