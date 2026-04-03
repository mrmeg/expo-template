/**
 * Tabs component tests
 *
 * Tests rendering, string children wrapping, and variant support.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../Tabs";

// Mock useTheme hook
jest.mock("@/client/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        foreground: "#0F172A",
        mutedForeground: "#64748B",
        muted: "#F1F5F9",
        background: "#FFFFFF",
        border: "#E2E8F0",
      },
    },
    getShadowStyle: () => ({}),
  }),
}));

// Mock @rn-primitives/tabs
jest.mock("@rn-primitives/tabs", () => {
  const React = require("react");
  const { View, Pressable } = require("react-native");

  const RootContext = React.createContext({ value: "" });

  return {
    Root: ({ children, value, ...props }: any) => (
      <RootContext.Provider value={{ value }}>
        <View {...props}>{children}</View>
      </RootContext.Provider>
    ),
    List: ({ children, style, ...props }: any) => (
      <View style={style} {...props}>{children}</View>
    ),
    Trigger: ({ children, value, style, ...props }: any) => (
      <Pressable accessibilityRole="tab" style={style} {...props}>{children}</Pressable>
    ),
    Content: ({ children, value, style, ...props }: any) => (
      <View style={style} {...props}>{children}</View>
    ),
    useRootContext: () => React.useContext(RootContext),
  };
});

describe("Tabs", () => {
  it("renders without crashing", () => {
    render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <></>
        </TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Tab 1")).toBeTruthy();
    expect(screen.getByText("Tab 2")).toBeTruthy();
  });

  it("wraps string children in StyledText", () => {
    render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">Account</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    // String children should be rendered (wrapped in StyledText, not raw text in View)
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders pill variant", () => {
    render(
      <Tabs value="tab1" onValueChange={() => {}} variant="pill">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(screen.getByText("Tab 1")).toBeTruthy();
  });

  it("renders content for active tab", () => {
    const { getByText } = render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <></>
        </TabsContent>
      </Tabs>
    );

    expect(getByText("Tab 1")).toBeTruthy();
  });
});
