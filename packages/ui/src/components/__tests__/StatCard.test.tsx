/**
 * StatCard tests — the dashboard stat idiom. Covers the value/unit render,
 * the three change directions (color + trend icon), and the optional
 * pressable behavior it delegates to Card.
 */

import "@/test/mockTheme";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";

import { StatCard } from "../StatCard";

function flattenStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>;
}

describe("StatCard", () => {
  it("renders the label and value", async () => {
    await render(<StatCard label="Revenue" value="48.2" />);

    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("48.2")).toBeTruthy();
  });

  it("renders a numeric value", async () => {
    await render(<StatCard label="Active Users" value={1204} />);

    expect(screen.getByText("1204")).toBeTruthy();
  });

  it("renders the unit suffix beside the value", async () => {
    await render(<StatCard label="Revenue" value="48.2" unit="k" />);

    expect(screen.getByText("k")).toBeTruthy();
  });

  it("does not render a unit when none is provided", async () => {
    await render(<StatCard label="Revenue" value="48.2" />);

    expect(screen.queryByText("k")).toBeNull();
  });

  it("colors an 'up' change with the success color and shows a trend icon", async () => {
    await render(
      <StatCard label="Revenue" value="48.2" change={{ value: "+12.5%", direction: "up" }} />,
    );

    expect(flattenStyle("+12.5%").color).toBe("#22C55E");
    expect(screen.getByTestId("icon-Feather", { includeHiddenElements: true })).toBeTruthy();
  });

  it("colors a 'down' change with the destructive color and shows a trend icon", async () => {
    await render(
      <StatCard label="Refunds" value="182" change={{ value: "-4.1%", direction: "down" }} />,
    );

    expect(flattenStyle("-4.1%").color).toBe("#EF4444");
    expect(screen.getByTestId("icon-Feather", { includeHiddenElements: true })).toBeTruthy();
  });

  it("colors a 'neutral' change with the muted text color and shows no trend icon", async () => {
    await render(
      <StatCard label="Active Users" value="1,204" change={{ value: "No change", direction: "neutral" }} />,
    );

    expect(flattenStyle("No change").color).toBe("#71717A");
    expect(screen.queryByTestId("icon-Feather", { includeHiddenElements: true })).toBeNull();
  });

  it("does not render a change line when none is provided", async () => {
    await render(<StatCard label="Revenue" value="48.2" />);

    expect(screen.queryByTestId("icon-Feather", { includeHiddenElements: true })).toBeNull();
  });

  it("fires onPress when pressed", async () => {
    const onPress = jest.fn();
    await render(<StatCard label="Orders" value="342" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is not pressable when onPress is omitted", async () => {
    await render(<StatCard label="Orders" value="342" />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
