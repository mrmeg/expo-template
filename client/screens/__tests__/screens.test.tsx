/**
 * Reusable screen template smoke tests.
 *
 * Per the spec: "Test that screen templates render with representative
 * props/defaults and do not crash". Asserts the user-visible strings
 * land in the rendered tree — keeps the tests resilient to layout
 * refactors while still catching the common regression (a refactor
 * stops rendering the title or the action button).
 */

import "@/test/mockTheme";

import React from "react";
import { Text, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ErrorScreen } from "../ErrorScreen";
import { ListScreen } from "../ListScreen";
import { WelcomeScreen } from "../WelcomeScreen";

describe("WelcomeScreen", () => {
  it("renders title, subtitle, primary action, and footer", () => {
    const onPrimary = jest.fn();
    render(
      <WelcomeScreen
        title="Welcome"
        subtitle="Get started"
        primaryAction={{ label: "Sign in", onPress: onPrimary }}
        footerText="By continuing you accept the terms."
      />,
    );

    expect(screen.getByText("Welcome")).toBeTruthy();
    expect(screen.getByText("Get started")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByText("By continuing you accept the terms.")).toBeTruthy();

    fireEvent.press(screen.getByText("Sign in"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorScreen", () => {
  it("renders the variant defaults when no overrides are supplied", () => {
    render(<ErrorScreen variant="not-found" />);
    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(
      screen.getByText("The page you're looking for doesn't exist or has been moved."),
    ).toBeTruthy();
  });

  it("prefers explicit title/description overrides", () => {
    render(
      <ErrorScreen
        variant="generic"
        title="Custom title"
        description="Custom description"
      />,
    );
    expect(screen.getByText("Custom title")).toBeTruthy();
    expect(screen.getByText("Custom description")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("invokes the primary action onPress", () => {
    const onPrimary = jest.fn();
    render(
      <ErrorScreen
        variant="generic"
        primaryAction={{ label: "Retry", onPress: onPrimary }}
      />,
    );
    fireEvent.press(screen.getByText("Retry"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("ListScreen", () => {
  it("renders provided items via renderItem", () => {
    const data = [
      { id: "1", label: "Alpha" },
      { id: "2", label: "Bravo" },
    ];
    render(
      <ListScreen
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={(item) => (
          <View>
            <Text>{item.label}</Text>
          </View>
        )}
      />,
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
  });

  it("shows the empty state title and description when data is empty", () => {
    render(
      <ListScreen
        data={[]}
        keyExtractor={() => ""}
        renderItem={() => null}
        emptyTitle="Nothing yet"
        emptyDescription="Add the first one"
      />,
    );
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByText("Add the first one")).toBeTruthy();
  });

  it("shows skeletons during the loading state instead of the empty UI", () => {
    render(
      <ListScreen
        data={[]}
        keyExtractor={() => ""}
        renderItem={() => null}
        loading
        skeletonCount={2}
        emptyTitle="Nothing yet"
      />,
    );
    expect(screen.queryByText("Nothing yet")).toBeNull();
  });
});
