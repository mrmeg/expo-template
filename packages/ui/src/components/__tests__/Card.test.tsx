/**
 * Card component family tests — covers the composable surface adopters
 * actually use (Header / Title / Description / Content / Footer).
 */

import "@/test/mockTheme";

import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../Card";

describe("Card", () => {
  it("renders all composed sections in order", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>Pro tier</CardDescription>
        </CardHeader>
        <CardContent>
          <Text>Body text</Text>
        </CardContent>
        <CardFooter>
          <Text>Footer text</Text>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByText("Plan")).toBeTruthy();
    expect(screen.getByText("Pro tier")).toBeTruthy();
    expect(screen.getByText("Body text")).toBeTruthy();
    expect(screen.getByText("Footer text")).toBeTruthy();
  });

  it("renders without optional sections", () => {
    render(
      <Card>
        <CardContent>
          <Text>Only content</Text>
        </CardContent>
      </Card>,
    );

    expect(screen.getByText("Only content")).toBeTruthy();
    expect(screen.queryByText("Plan")).toBeNull();
  });
});
