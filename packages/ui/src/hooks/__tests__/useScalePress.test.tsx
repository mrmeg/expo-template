import { act, renderHook } from "@testing-library/react-native";
import { Animated } from "react-native";
import { useScalePress } from "../useScalePress";

const mockReduceMotion = { value: false };
jest.mock("../useReduceMotion", () => ({
  useReducedMotion: () => mockReduceMotion.value,
}));

const mockImpactAsync = jest.fn();
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

function readScale(scale: Animated.Value): number {
  return (scale as unknown as { __getValue: () => number }).__getValue();
}

describe("useScalePress", () => {
  beforeEach(() => {
    mockReduceMotion.value = false;
    mockImpactAsync.mockClear();
  });

  it("keeps the scale at 1 under reduce motion", async () => {
    mockReduceMotion.value = true;
    const { result } = await renderHook(() => useScalePress({ scaleTo: 0.9 }));
    await act(() => { result.current.pressHandlers.onPressIn(); });
    expect(readScale(result.current.scale)).toBe(1);
  });

  it("does not vibrate by default under the selection setting", async () => {
    const { result } = await renderHook(() => useScalePress());
    await act(() => { result.current.pressHandlers.onPressIn(); });
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it("haptic: true vibrates regardless of the setting", async () => {
    const { result } = await renderHook(() => useScalePress({ haptic: true }));
    await act(() => { result.current.pressHandlers.onPressIn(); });
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });
});
