/**
 * SectionHeader tests — the eyebrow -> title -> description composition
 * primitive. Covers the default leading alignment, the centered variant,
 * and rendering with only the required `title`.
 */

import "@/test/mockTheme";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { SectionHeader } from "../SectionHeader";

function flattenStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>;
}

describe("SectionHeader", () => {
  it("renders eyebrow, title, and description", async () => {
    await render(
      <SectionHeader
        eyebrow="Pricing"
        title="Simple, transparent plans"
        description="Pick the plan that fits your team."
      />,
    );

    expect(screen.getByText("Pricing")).toBeTruthy();
    expect(screen.getByText("Simple, transparent plans")).toBeTruthy();
    expect(screen.getByText("Pick the plan that fits your team.")).toBeTruthy();
  });

  it("renders with only the required title", async () => {
    await render(<SectionHeader title="Just a title" />);

    expect(screen.getByText("Just a title")).toBeTruthy();
    expect(screen.queryByText("Pricing")).toBeNull();
  });

  it("centers text and constrains description width when align is center", async () => {
    await render(
      <SectionHeader
        align="center"
        title="Centered title"
        description="Centered description text"
      />,
    );

    expect(flattenStyle("Centered title").textAlign).toBe("center");

    const descriptionStyle = flattenStyle("Centered description text");
    expect(descriptionStyle.textAlign).toBe("center");
    expect(descriptionStyle.maxWidth).toBe(560);
  });

  it("does not constrain description width in the default leading alignment", async () => {
    await render(<SectionHeader title="Leading title" description="Leading description" />);

    const descriptionStyle = flattenStyle("Leading description");
    expect(descriptionStyle.maxWidth).toBeUndefined();
    expect(descriptionStyle.textAlign).toBe("left");
  });
});
