import { setHaptics, useFeedbackStore } from "../feedbackStore";

describe("feedbackStore", () => {
  afterEach(() => {
    useFeedbackStore.setState({ haptics: "selection" });
  });

  it("defaults to selection haptics", () => {
    expect(useFeedbackStore.getState().haptics).toBe("selection");
  });

  it("stores the setting through the action and the imperative helper", () => {
    useFeedbackStore.getState().setHaptics("off");
    expect(useFeedbackStore.getState().haptics).toBe("off");
    setHaptics("all");
    expect(useFeedbackStore.getState().haptics).toBe("all");
  });
});
