/**
 * EmptyState tests — the component is the default empty/error UI for
 * lists, search, and the Media tab's setup state. Cover the title-only,
 * with-description, with-icon, and with-action paths.
 */

import "@/test/mockTheme";

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("renders an optional description", () => {
    render(<EmptyState title="Nothing here" description="Try a different filter" />);
    expect(screen.getByText("Try a different filter")).toBeTruthy();
  });

  it("renders the icon when provided (testID exposed by the Icon mock)", () => {
    render(<EmptyState title="No inbox" icon="inbox" />);
    expect(screen.getByTestId("icon-Feather")).toBeTruthy();
  });

  it("calls onAction when the CTA button is pressed", () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        title="No items"
        actionLabel="Add one"
        onAction={onAction}
      />,
    );

    fireEvent.press(screen.getByText("Add one"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not render an action button when only actionLabel is provided (action requires onAction too)", () => {
    render(<EmptyState title="No items" actionLabel="Add one" />);
    expect(screen.queryByText("Add one")).toBeNull();
  });
});
