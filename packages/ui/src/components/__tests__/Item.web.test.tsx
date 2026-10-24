/**
 * Item on web, rendered through `react-dom/server` and react-native-web, the
 * way server rendering does it (no DOM), so the markup is what a browser
 * receives. `react-native` is swapped for react-native-web below; the focus
 * ring on keyboard focus is covered in pressableFocusRing.web.test.tsx.
 * `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Item, ItemContent, ItemDescription, ItemTitle } from "../Item";

// expo-modules-core, which jest-expo loads lazily behind the `fetch` global (jest's
// teardown reads every global), reads `TurboModuleRegistry` from `react-native`;
// react-native-web has none, and that read would warn after the tests finish and
// fail the run.
jest.mock("react-native", () => ({
  ...require("react-native-web"),
  TurboModuleRegistry: jest.requireActual("react-native").TurboModuleRegistry,
}));

// `Item` imports `Icon`, which Jest resolves to the native react-native-svg glyph.
// Since react-native-svg 15.16 that module reads `codegenNativeComponent` from the
// `react-native` root, which the react-native-web swap above does not have, so the
// suite failed to load. No row here draws an icon; `registerIcons` is what
// test/setup.ts calls.
jest.mock("../Icon", () => ({ Icon: () => null, registerIcons: () => {} }));

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        border: "#e5e5e5",
        muted: "#f4f4f5",
        mutedForeground: "#71717a",
        text: "#111",
        textDim: "#666",
        foreground: "#111",
      },
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
  }),
}));

const row = (
  <ItemContent>
    <ItemTitle>Ada Lovelace</ItemTitle>
    <ItemDescription>Acme</ItemDescription>
  </ItemContent>
);

describe("Item accessibility props (web)", () => {
  it("renders a pressable row as one button named by aria-label, with a data-testid", () => {
    const html = renderToStaticMarkup(
      <Item
        onPress={() => {}}
        accessibilityLabel="Ada Lovelace, Acme"
        accessibilityHint="Opens the contact"
        accessibilityActions={[{ name: "open", label: "Open contact" }]}
        testID="row-1"
      >
        {row}
      </Item>,
    );

    const button = html.match(/^<button\b[^>]*>/)?.[0] ?? "";
    expect(button).toContain('role="button"');
    expect(button).toContain('aria-label="Ada Lovelace, Acme"');
    expect(button).toContain('data-testid="row-1"');
    // react-native-web drops the hint and the actions: native-only.
    expect(html).not.toContain("Opens the contact");
    expect(html).not.toContain("Open contact");
  });

  it("keeps the pointer cursor and drops the outline on a pressable row", () => {
    const html = renderToStaticMarkup(
      <Item onPress={() => {}} accessibilityLabel="Ada Lovelace, Acme">
        {row}
      </Item>,
    );

    const button = html.match(/^<button\b[^>]*>/)?.[0] ?? "";
    expect(button).toContain("cursor:pointer");
    expect(button).toContain("outline-style:none");
  });

  it("puts testID on a static row without naming it", () => {
    const html = renderToStaticMarkup(
      <Item testID="static-row" accessibilityLabel="ignored">
        {row}
      </Item>,
    );

    expect(html.match(/^<div\b[^>]*>/)?.[0]).toContain('data-testid="static-row"');
    expect(html).not.toContain("aria-label");
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("<button");
  });

  it("puts testID on the wrapper of a static row with a separator", () => {
    const html = renderToStaticMarkup(
      <Item testID="static-row" separator>
        {row}
      </Item>,
    );

    expect(html.match(/^<div\b[^>]*>/)?.[0]).toContain('data-testid="static-row"');
    expect(html.match(/data-testid="static-row"/g)).toHaveLength(1);
  });
});
