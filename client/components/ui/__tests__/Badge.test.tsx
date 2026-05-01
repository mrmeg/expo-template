/**
 * Badge tests — every variant renders its children and the component
 * accepts plain string children (the form Explore uses for "X components").
 */

import "@/test/mockTheme";

import React from "react";
import { render, screen } from "@testing-library/react-native";

import { Badge, type BadgeVariant } from "../Badge";

describe("Badge", () => {
  const variants: BadgeVariant[] = ["default", "secondary", "outline", "destructive"];

  it.each(variants)("renders the %s variant with text children", (variant) => {
    render(<Badge variant={variant}>{`badge-${variant}`}</Badge>);
    expect(screen.getByText(`badge-${variant}`)).toBeTruthy();
  });

  it("renders the default variant when no variant is supplied", () => {
    render(<Badge>plain</Badge>);
    expect(screen.getByText("plain")).toBeTruthy();
  });
});
