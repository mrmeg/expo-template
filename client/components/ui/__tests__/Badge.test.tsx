/**
 * Badge tests — every variant renders its children and the component
 * accepts plain string and mixed primitive children.
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

  it("renders adjacent number and string children as badge text", () => {
    render(<Badge variant="outline">{4} components</Badge>);
    expect(screen.getByText("4 components")).toBeTruthy();
  });
});
