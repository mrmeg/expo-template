/**
 * MediaSelectionBar: the summary text, the select-all checkbox's checked and
 * indeterminate states, which buttons show and when they are disabled, and the
 * localized labels.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MediaSelectionBar, type MediaSelectionBarProps } from "../MediaSelectionBar";

const handlers = () => ({ onToggleAll: jest.fn(), onClear: jest.fn(), onDelete: jest.fn() });

const renderBar = async (props: Partial<MediaSelectionBarProps> = {}) => {
  const fns = handlers();
  const result = await render(<MediaSelectionBar selectedCount={0} totalCount={12} {...fns} {...props} />);
  return { ...fns, result };
};

const selectAll = () => screen.getByRole("checkbox");
const deleteButton = () => screen.getByRole("button", { name: /^Delete/ });

describe("MediaSelectionBar", () => {
  it("summarizes the item count while nothing is selected", async () => {
    await renderBar();

    expect(screen.getByText("12 items")).toBeTruthy();
    expect(screen.getByText("Select all")).toBeTruthy();
  });

  it("summarizes the selection once something is selected", async () => {
    await renderBar({ selectedCount: 3 });

    expect(screen.getByText("3 selected")).toBeTruthy();
    expect(screen.queryByText("12 items")).toBeNull();
  });

  describe("select-all checkbox", () => {
    it("is unchecked with nothing selected", async () => {
      await renderBar();

      expect(selectAll().props.accessibilityState).toMatchObject({ checked: false });
      expect(screen.queryByTestId("icon-minus", { includeHiddenElements: true })).toBeNull();
    });

    it("is indeterminate with some selected", async () => {
      await renderBar({ selectedCount: 3 });

      // The dash glyph marks the indeterminate state, and the box is not the "all" check.
      expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByTestId("icon-minus", { includeHiddenElements: true })).not.toBeNull();
      expect(screen.getByText("Select all")).toBeTruthy();
    });

    it("is checked, and offers Deselect all, with everything selected", async () => {
      await renderBar({ selectedCount: 12 });

      expect(selectAll().props.accessibilityState).toMatchObject({ checked: true });
      expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).not.toBeNull();
      expect(screen.queryByTestId("icon-minus", { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText("Deselect all")).toBeTruthy();
    });

    it("calls onToggleAll", async () => {
      const { onToggleAll } = await renderBar();

      await fireEvent.press(selectAll());

      expect(onToggleAll).toHaveBeenCalledTimes(1);
    });

    it("is disabled when there is nothing to select", async () => {
      const { onToggleAll } = await renderBar({ totalCount: 0 });

      expect(selectAll().props.accessibilityState).toMatchObject({ checked: false, disabled: true });
      await fireEvent.press(selectAll());
      expect(onToggleAll).not.toHaveBeenCalled();
      expect(screen.getByText("0 items")).toBeTruthy();
    });
  });

  describe("Clear", () => {
    it("shows only while something is selected, and calls onClear", async () => {
      const { result, onClear } = await renderBar();
      expect(screen.queryByText("Clear")).toBeNull();

      await result.rerender(<MediaSelectionBar selectedCount={2} totalCount={12} onToggleAll={jest.fn()} onClear={onClear} onDelete={jest.fn()} />);
      await fireEvent.press(screen.getByText("Clear"));

      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe("Delete", () => {
    it("is disabled and plain with nothing selected", async () => {
      const { onDelete } = await renderBar();

      expect(screen.getByText("Delete")).toBeTruthy();
      expect(deleteButton().props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(deleteButton());
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("shows the count and calls onDelete once something is selected", async () => {
      const { onDelete } = await renderBar({ selectedCount: 3 });

      expect(screen.getByText("Delete (3)")).toBeTruthy();
      await fireEvent.press(deleteButton());

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("draws the delete icon the caller names", async () => {
      await renderBar({ selectedCount: 1, deleteIcon: "circle-alert" });

      expect(screen.queryByTestId("icon-circle-alert", { includeHiddenElements: true })).not.toBeNull();
    });

    it("shows a spinner only while deleting", async () => {
      const { result, ...rest } = await renderBar({ selectedCount: 3 });
      expect(screen.root!.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(0);

      await result.rerender(<MediaSelectionBar selectedCount={3} totalCount={12} {...rest} deleting />);

      expect(screen.root!.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(1);
    });
  });

  describe("busy", () => {
    it("disables every control", async () => {
      const { onToggleAll, onClear, onDelete } = await renderBar({ selectedCount: 3, busy: true });

      await fireEvent.press(selectAll());
      await fireEvent.press(screen.getByText("Clear"));
      await fireEvent.press(deleteButton());

      expect(selectAll().props.accessibilityState).toMatchObject({ disabled: true });
      expect(onToggleAll).not.toHaveBeenCalled();
      expect(onClear).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it("takes localized labels", async () => {
    await renderBar({
      selectedCount: 2,
      selectAllLabel: "Elegir todo",
      selectedSummary: (count) => `${count} elegidos`,
      clearLabel: "Quitar",
      deleteLabel: (count) => `Borrar (${count})`,
    });

    expect(screen.getByText("Elegir todo")).toBeTruthy();
    expect(screen.getByText("2 elegidos")).toBeTruthy();
    expect(screen.getByText("Quitar")).toBeTruthy();
    expect(screen.getByText("Borrar (2)")).toBeTruthy();
  });

  it("takes localized deselect and total labels", async () => {
    const { result, ...rest } = await renderBar({
      selectedCount: 12,
      deselectAllLabel: "Quitar todo",
      totalSummary: (count) => `${count} elementos`,
    });
    expect(screen.getByText("Quitar todo")).toBeTruthy();

    await result.rerender(<MediaSelectionBar selectedCount={0} totalCount={12} {...rest} totalSummary={(count) => `${count} elementos`} />);
    expect(screen.getByText("12 elementos")).toBeTruthy();
  });
});
