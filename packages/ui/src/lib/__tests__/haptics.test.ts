const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

import { Platform } from "react-native";

import {
  hapticLight,
  hapticMedium,
  hapticPress,
  hapticSelection,
  hapticSuccess,
} from "../haptics";
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

describe("haptics on Android with VIBRATE blocked", () => {
  const originalOS = Platform.OS;
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    Platform.OS = "android";
    unhandled.length = 0;
    process.on("unhandledRejection", onUnhandled);
    const reject = () =>
      Promise.reject(new Error("Requires VIBRATE permission"));
    mockImpactAsync.mockImplementation(reject);
    mockNotificationAsync.mockImplementation(reject);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    mockImpactAsync.mockReset();
    mockNotificationAsync.mockReset();
    Platform.OS = originalOS;
  });

  it("swallows the expo-haptics rejection", async () => {
    useFeedbackStore.setState({ haptics: "all" });
    expect(() => {
      hapticLight();
      hapticMedium();
      hapticSuccess();
      hapticSelection();
      hapticPress();
    }).not.toThrow();
    // unhandledRejection is emitted after the microtask queue drains.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockImpactAsync).toHaveBeenCalledTimes(4);
    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
    expect(unhandled).toEqual([]);
  });
});
