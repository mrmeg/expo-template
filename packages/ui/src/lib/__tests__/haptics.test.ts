const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

import { hapticPress, hapticSelection } from "../haptics";
import { useFeedbackStore } from "../../state/feedbackStore";

describe("gated haptics", () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    useFeedbackStore.setState({ haptics: "selection" });
  });

  it("selection fires by default and under all, not under off", () => {
    hapticSelection();
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    useFeedbackStore.setState({ haptics: "all" });
    hapticSelection();
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
    useFeedbackStore.setState({ haptics: "off" });
    hapticSelection();
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
  });

  it("press fires only under all", () => {
    hapticPress();
    useFeedbackStore.setState({ haptics: "off" });
    hapticPress();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    useFeedbackStore.setState({ haptics: "all" });
    hapticPress();
    expect(mockImpactAsync).toHaveBeenCalledWith("light");
  });
});
