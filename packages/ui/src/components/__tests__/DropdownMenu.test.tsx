/**
 * DropdownMenu component tests
 *
 * Locks in the accessibility fix for DropdownMenuTrigger: the bare
 * @rn-primitives Trigger renders a RN-Web Pressable without a role, so on web
 * it becomes `role="generic"`. Our wrapper defaults `accessibilityRole="button"`
 * so screen readers and `getByRole("button")` queries work. An explicit role on
 * the trigger (or its `asChild` child) must still win.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { DropdownMenu, DropdownMenuTrigger } from "../DropdownMenu";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: "#111111",
        border: "#E2E8F0",
        popover: "#FFFFFF",
        muted: "#F1F5F9",
      },
    },
    getShadowStyle: () => ({}),
  }),
}));

// Mock @rn-primitives/dropdown-menu: the Trigger renders a Pressable that
// forwards whatever props it receives, mirroring the real web primitive
// (which itself sets no role).
jest.mock("@rn-primitives/dropdown-menu", () => {
  const { View, Pressable } = require("react-native");

  return {
    Root: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Trigger: ({ children, ...props }: any) => (
      <Pressable {...props}>{children}</Pressable>
    ),
    Group: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Portal: ({ children }: any) => <>{children}</>,
    Sub: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    RadioGroup: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

describe("DropdownMenuTrigger", () => {
  it("defaults accessibilityRole to button", async () => {
    await render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <></>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );

    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("lets an explicit accessibilityRole override the default", async () => {
    await render(
      <DropdownMenu>
        <DropdownMenuTrigger accessibilityRole="menu">
          <></>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
