import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { UIProvider } from "../UIProvider";
import { useFeedbackStore } from "../../state/feedbackStore";

jest.mock("@rn-primitives/portal", () => ({ PortalHost: () => null }));
jest.mock("../Notification", () => ({ Notification: () => null }));
jest.mock("../StatusBar", () => ({ StatusBar: () => null }));

describe("UIProvider haptics", () => {
  afterEach(() => {
    useFeedbackStore.setState({ haptics: "selection" });
  });

  it("leaves the default setting alone when the prop is omitted", async () => {
    await render(<UIProvider><Text>x</Text></UIProvider>);
    expect(useFeedbackStore.getState().haptics).toBe("selection");
  });

  it("writes the prop into the feedback store and follows changes", async () => {
    const { rerender } = await render(<UIProvider haptics="all"><Text>x</Text></UIProvider>);
    expect(useFeedbackStore.getState().haptics).toBe("all");
    await rerender(<UIProvider haptics="off"><Text>x</Text></UIProvider>);
    expect(useFeedbackStore.getState().haptics).toBe("off");
  });
});
