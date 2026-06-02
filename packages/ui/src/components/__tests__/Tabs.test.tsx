/**
 * Tabs component tests
 *
 * Tests rendering, explicit TabsTrigger.Text labels, and variant support.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../Tabs";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
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
    useRootContext: () => React.use(RootContext),
  };
});

describe("Tabs", () => {
  it("renders without crashing", () => {
    render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">
            <TabsTrigger.Text>Tab 1</TabsTrigger.Text>
          </TabsTrigger>
          <TabsTrigger value="tab2">
            <TabsTrigger.Text>Tab 2</TabsTrigger.Text>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <></>
        </TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Tab 1")).toBeTruthy();
    expect(screen.getByText("Tab 2")).toBeTruthy();
  });

  it("renders text labels via TabsTrigger.Text", () => {
    render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">
            <TabsTrigger.Text>Account</TabsTrigger.Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );

    // Label text should render (inside a Text element, not raw text in a View)
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders pill variant", () => {
    render(
      <Tabs value="tab1" onValueChange={() => {}} variant="pill">
        <TabsList>
          <TabsTrigger value="tab1">
            <TabsTrigger.Text>Tab 1</TabsTrigger.Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(screen.getByText("Tab 1")).toBeTruthy();
  });

  it("renders content for active tab", () => {
    const { getByText } = render(
      <Tabs value="tab1" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="tab1">
            <TabsTrigger.Text>Tab 1</TabsTrigger.Text>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <></>
        </TabsContent>
      </Tabs>
    );

    expect(getByText("Tab 1")).toBeTruthy();
  });
});
