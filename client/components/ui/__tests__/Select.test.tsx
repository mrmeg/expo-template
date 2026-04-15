/**
 * Select component tests
 *
 * Tests trigger rendering and placeholder display.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../Select";

// Mock useTheme hook
jest.mock("@/client/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        foreground: "#0F172A",
        background: "#FFFFFF",
        border: "#E2E8F0",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        primary: "#18181B",
        overlay: "rgba(0,0,0,0.5)",
      },
    },
    getShadowStyle: () => ({}),
    getContrastingColor: (_bg: string, fg: string) => fg,
  }),
}));

// Mock @rn-primitives/select
jest.mock("@rn-primitives/select", () => {
  const React = require("react");
  const { View, Pressable, Text } = require("react-native");

  const SelectContext = React.createContext({ value: undefined as any });

  return {
    Root: ({ children, value, onValueChange, ...props }: any) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <View {...props}>{children}</View>
      </SelectContext.Provider>
    ),
    Trigger: ({ children, style, ...props }: any) => (
      <Pressable accessibilityRole="button" style={style} {...props}>{children}</Pressable>
    ),
    Value: ({ placeholder, style, ...props }: any) => {
      const { value } = React.useContext(SelectContext);
      return <Text style={style} {...props}>{value?.label || placeholder}</Text>;
    },
    Content: ({ children, style, ...props }: any) => (
      <View style={style} {...props}>{children}</View>
    ),
    Item: ({ children, value, label, style, ...props }: any) => (
      <Pressable style={style} {...props}><Text>{label}</Text></Pressable>
    ),
    Group: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Label: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    useRootContext: () => React.useContext(SelectContext),
    Overlay: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Portal: ({ children, ...props }: any) => <>{children}</>,
    ItemText: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    ScrollUpButton: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    ScrollDownButton: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Viewport: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Separator: (props: any) => <View {...props} />,
  };
});

describe("Select", () => {
  it("renders trigger with placeholder", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple" label="Apple" />
        </SelectContent>
      </Select>
    );

    expect(screen.getByText("Choose a fruit")).toBeTruthy();
  });

  it("renders with selected value", () => {
    render(
      <Select value={{ value: "apple", label: "Apple" }}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple" label="Apple" />
        </SelectContent>
      </Select>
    );

    expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
  });

  it("renders select items", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" label="Option A" />
          <SelectItem value="b" label="Option B" />
          <SelectItem value="c" label="Option C" />
        </SelectContent>
      </Select>
    );

    expect(screen.getByText("Option A")).toBeTruthy();
    expect(screen.getByText("Option B")).toBeTruthy();
    expect(screen.getByText("Option C")).toBeTruthy();
  });
});
