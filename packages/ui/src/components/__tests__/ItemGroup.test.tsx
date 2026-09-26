/**
 * ItemGroup tests: the flat grouped list. Covers the optional header and
 * footer, the separator drawn under every row but the last (including rows
 * wrapped in app components), the separator inset following the media slot,
 * and that the group paints no surface of its own.
 */

import "@/test/mockTheme";

import React from "react";
import { Platform, StyleSheet, type ViewStyle } from "react-native";
import { render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "../Item";
import { spacing } from "../../constants/spacing";

function flatStyle(instance: TestInstance): ViewStyle {
  return (StyleSheet.flatten(instance.props.style) ?? {}) as ViewStyle;
}

/** Host Views drawn as row hairlines. */
function separators(): TestInstance[] {
  return (
    screen.root?.queryAll(
      (node) => node.type === "View" && flatStyle(node).height === StyleSheet.hairlineWidth,
    ) ?? []
  );
}

function Row({ label, media = false }: { label: string; media?: boolean }) {
  return (
    <Item>
      {media && <ItemMedia icon="bell" />}
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
      </ItemContent>
    </Item>
  );
}

describe("ItemGroup", () => {
  it("renders the title as a header, the description, the rows, and the footer", async () => {
    await render(
      <ItemGroup title="Account" description="Who you are here" footer="Changes sync to every device.">
        <Row label="Edit profile" />
        <Row label="Change password" />
      </ItemGroup>,
    );

    expect(screen.getByRole("header", { name: "Account" })).toBeTruthy();
    expect(screen.getByText("Who you are here")).toBeTruthy();
    expect(screen.getByText("Edit profile")).toBeTruthy();
    expect(screen.getByText("Change password")).toBeTruthy();
    expect(screen.getByText("Changes sync to every device.")).toBeTruthy();
  });

  it("renders rows alone when no header or footer is given", async () => {
    await render(
      <ItemGroup>
        <Row label="Only row" />
      </ItemGroup>,
    );

    expect(screen.getByText("Only row")).toBeTruthy();
    expect(screen.queryByRole("header")).toBeNull();
  });

  it("draws a hairline under every row but the last", async () => {
    await render(
      <ItemGroup title="Three rows">
        <Row label="One" />
        <Row label="Two" />
        <Row label="Three" />
      </ItemGroup>,
    );

    expect(separators()).toHaveLength(2);
  });

  it("skips conditional rows that render nothing when counting the last row", async () => {
    const showThird = false;
    await render(
      <ItemGroup>
        <Row label="One" />
        <Row label="Two" />
        {showThird && <Row label="Three" />}
      </ItemGroup>,
    );

    expect(separators()).toHaveLength(1);
  });

  it("separates rows mapped from an array", async () => {
    await render(
      <ItemGroup>
        {["a", "b", "c", "d"].map((id) => (
          <Row key={id} label={id} />
        ))}
      </ItemGroup>,
    );

    expect(separators()).toHaveLength(3);
  });

  it("lets a row opt out of its separator", async () => {
    await render(
      <ItemGroup>
        <Item separator={false}>
          <ItemContent>
            <ItemTitle>No line</ItemTitle>
          </ItemContent>
        </Item>
        <Row label="Last" />
      </ItemGroup>,
    );

    expect(separators()).toHaveLength(0);
  });

  it("starts the hairline under the title: past the media slot, or at the row padding", async () => {
    await render(
      <ItemGroup>
        <Row label="With media" media />
        <Row label="Without media" />
        <Item>
          <ItemMedia size={56} />
          <ItemContent>
            <ItemTitle>Large media</ItemTitle>
          </ItemContent>
        </Item>
        <Row label="Last" />
      </ItemGroup>,
    );

    expect(separators().map((node) => flatStyle(node).marginLeft)).toEqual([
      spacing.rowPaddingX + 40 + spacing.rowGap,
      spacing.rowPaddingX,
      spacing.rowPaddingX + 56 + spacing.rowGap,
    ]);
  });

  it("paints no border, radius, shadow, fill, or horizontal padding of its own", async () => {
    await render(
      <ItemGroup testID="group" title="Plain">
        <Row label="Row" />
      </ItemGroup>,
    );

    const style = flatStyle(screen.getByTestId("group"));
    expect(style.borderWidth).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
    expect(style.boxShadow).toBeUndefined();
    expect(style.padding).toBeUndefined();
    expect(style.paddingHorizontal).toBeUndefined();
  });

  it("keeps the standalone separator prop working outside a group", async () => {
    await render(
      <>
        <Item separator>
          <ItemMedia icon="bell" />
          <ItemContent>
            <ItemTitle>Standalone</ItemTitle>
          </ItemContent>
          <ItemActions />
        </Item>
        <Item>
          <ItemContent>
            <ItemTitle>No separator by default</ItemTitle>
          </ItemContent>
        </Item>
      </>,
    );

    expect(separators()).toHaveLength(1);
    expect(flatStyle(separators()[0]).marginLeft).toBe(spacing.rowPaddingX + 40 + spacing.rowGap);
  });

  describe("on web", () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      Platform.OS = "web";
    });

    afterEach(() => {
      Platform.OS = originalOS;
    });

    it("levels the title as an h2 instead of react-native-web's default h1", async () => {
      await render(
        <ItemGroup title="Preferences">
          <Row label="Row" />
        </ItemGroup>,
      );

      expect(screen.getByRole("header", { name: "Preferences" }).props["aria-level"]).toBe(2);
    });
  });
});
