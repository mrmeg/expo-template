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
  it("renders the title", async () => {
    await render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("renders an optional description", async () => {
    await render(<EmptyState title="Nothing here" description="Try a different filter" />);
    expect(screen.getByText("Try a different filter")).toBeTruthy();
  });

  it("renders the icon when provided (testID exposed by the Icon mock)", async () => {
    await render(<EmptyState title="No inbox" icon="inbox" />);
    expect(screen.getByTestId("icon-Feather")).toBeTruthy();
  });

  it("calls onAction when the CTA button is pressed", async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        title="No items"
        actionLabel="Add one"
        onAction={onAction}
      />,
    );

    await fireEvent.press(screen.getByText("Add one"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("centers the action button in wide containers", async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        title="No items"
        actionLabel="Add one"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("button").props.style).toMatchObject({
      alignSelf: "center",
    });
  });

  it("does not render an action button when only actionLabel is provided (action requires onAction too)", async () => {
    await render(<EmptyState title="No items" actionLabel="Add one" />);
    expect(screen.queryByText("Add one")).toBeNull();
  });
});
