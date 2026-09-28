/**
 * useFocusVisible: one implementation of the `:focus-visible` gate the kit's
 * controls used to copy. On web a pointer tap focuses the element too, so
 * the ring shows only for keyboard focus; elsewhere any focus shows it.
 */
import React from "react";
import { Platform, Pressable, Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { useFocusVisible } from "../useFocusVisible";

function Probe({ onFocus, onBlur }: { onFocus?: (e: unknown) => void; onBlur?: (e: unknown) => void }) {
  const focus = useFocusVisible({ onFocus, onBlur });
  return (
    <Pressable accessibilityRole="button" onFocus={focus.onFocus} onBlur={focus.onBlur}>
      <Text>{focus.focused ? "focused" : "idle"}</Text>
    </Pressable>
  );
}

const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
});

describe("useFocusVisible", () => {
  it("starts unfocused and toggles with focus and blur off web", async () => {
    Platform.OS = "ios";
    await render(<Probe />);
    expect(screen.getByText("idle")).toBeTruthy();
    await fireEvent(screen.getByRole("button"), "focus", { nativeEvent: { target: 1 } });
    expect(screen.getByText("focused")).toBeTruthy();
    await fireEvent(screen.getByRole("button"), "blur", { nativeEvent: { target: 1 } });
    expect(screen.getByText("idle")).toBeTruthy();
  });

  it("on web shows the ring only when the target matches :focus-visible", async () => {
    Platform.OS = "web";
    await render(<Probe />);
    const button = screen.getByRole("button");
    await fireEvent(button, "focus", { nativeEvent: { target: { matches: (s: string) => s === ":focus-visible" && false } } });
    expect(screen.getByText("idle")).toBeTruthy();
    await fireEvent(button, "focus", { nativeEvent: { target: { matches: () => true } } });
    expect(screen.getByText("focused")).toBeTruthy();
  });

  it("on web falls back to showing the ring when the target cannot be queried", async () => {
    Platform.OS = "web";
    await render(<Probe />);
    await fireEvent(screen.getByRole("button"), "focus", { nativeEvent: { target: 7 } });
    expect(screen.getByText("focused")).toBeTruthy();
  });

  it("forwards the caller's focus and blur handlers with the event", async () => {
    Platform.OS = "ios";
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<Probe onFocus={onFocus} onBlur={onBlur} />);
    const focusEvent = { nativeEvent: { target: 1 } };
    const blurEvent = { nativeEvent: { target: 2 } };
    await fireEvent(screen.getByRole("button"), "focus", focusEvent);
    await fireEvent(screen.getByRole("button"), "blur", blurEvent);
    expect(onFocus).toHaveBeenCalledWith(focusEvent);
    expect(onBlur).toHaveBeenCalledWith(blurEvent);
  });
});
