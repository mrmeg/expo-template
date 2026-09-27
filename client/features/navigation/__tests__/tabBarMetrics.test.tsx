/**
 * The native tab layout tells global toasts where the tab bar ends: a bottom
 * `notify` must clear the bar's labels, and return to the safe-area inset
 * while the bar hides behind the keyboard.
 */
import React from "react";
import { Platform } from "react-native";
import { act, render, renderHook } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { globalUIStore, selectNotificationOffset } from "@mrmeg/expo-ui/state";
import { NATIVE_TAB_BAR_HEIGHT, useNativeTabBarOffset } from "../tabBarMetrics";

const keyboardState = { visible: false };
jest.mock("@/client/features/keyboard/platform", () => ({
  useKeyboardVisible: () => keyboardState.visible,
}));

jest.mock("expo-router/native-tabs", () => {
  const React = require("react");
  const { View } = require("react-native");
  const NativeTabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const Trigger = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Trigger.Label = () => null;
  Trigger.Icon = () => null;
  Trigger.VectorIcon = () => null;
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

jest.mock("@expo/vector-icons/Feather", () => ({}));

import TabLayout from "@/app/(main)/(tabs)/_layout.native";

const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };
const offset = () => selectNotificationOffset(globalUIStore.getState());

describe("useNativeTabBarOffset", () => {
  it("is the platform tab bar height plus the bottom inset", async () => {
    const { result } = await renderHook(() => useNativeTabBarOffset(), {
      wrapper: ({ children }) => (
        <SafeAreaInsetsContext.Provider value={INSETS}>{children}</SafeAreaInsetsContext.Provider>
      ),
    });
    expect(NATIVE_TAB_BAR_HEIGHT).toBe(Platform.OS === "android" ? 56 : 49);
    expect(result.current).toBe(NATIVE_TAB_BAR_HEIGHT + 34);
  });
});

describe("native TabLayout toast offset", () => {
  afterEach(() => {
    keyboardState.visible = false;
    globalUIStore.setState({ notificationOffsets: {} });
  });

  it("registers the tab bar as a bottom offset while mounted", async () => {
    const { unmount } = await render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <TabLayout />
      </SafeAreaInsetsContext.Provider>
    );
    expect(offset().bottom).toBe(NATIVE_TAB_BAR_HEIGHT + 34);
    await act(() => unmount());
    expect(offset().bottom).toBe(0);
  });

  it("registers nothing while the keyboard hides the tab bar", async () => {
    keyboardState.visible = true;
    await render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <TabLayout />
      </SafeAreaInsetsContext.Provider>
    );
    expect(offset().bottom).toBe(0);
  });
});
