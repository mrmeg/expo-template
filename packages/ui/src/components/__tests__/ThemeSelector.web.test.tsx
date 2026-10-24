/**
 * ThemeSelector on web, rendered through `react-dom/server` and
 * react-native-web the way server rendering does it, so the markup is what a
 * browser receives. react-native-web 0.21 ignores `accessibilityState`, so a
 * segment's checked state reaches the DOM only as `aria-checked`.
 * `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ThemeSelector } from "../ThemeSelector";
import { Item, ItemActions, ItemContent, ItemTitle } from "../Item";

// expo-modules-core, which jest-expo loads lazily behind the `fetch` global (jest's
// teardown reads every global), reads `TurboModuleRegistry` from `react-native`;
// react-native-web has none, and that read would warn after the tests finish and
// fail the run.
jest.mock("react-native", () => ({
  ...require("react-native-web"),
  TurboModuleRegistry: jest.requireActual("react-native").TurboModuleRegistry,
}));

// The glyph is irrelevant here, and Jest resolves the native react-native-svg glyph,
// which cannot load under react-native-web. `registerIcons` is what test/setup.ts calls.
jest.mock("../Icon", () => ({ Icon: () => null, registerIcons: () => {} }));

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        border: "#E2E8F0",
        textDim: "#666",
        text: "#111",
        ring: "#A1A1AA",
      },
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
  }),
}));

jest.mock("../../lib/haptics", () => ({ hapticSelection: jest.fn() }));

/** The opening tag of the element carrying `data-testid`. */
const tag = (html: string, testID: string) =>
  html.match(new RegExp(`<[a-z]+\\b[^>]*data-testid="${testID}"[^>]*>`))?.[0] ?? "";

describe("ThemeSelector on web", () => {
  it("renders aria-checked on every radio, true on exactly the selected one", () => {
    const html = renderToStaticMarkup(<ThemeSelector value="light" />);

    expect(tag(html, "theme-selector-system")).toContain('aria-checked="false"');
    expect(tag(html, "theme-selector-light")).toContain('aria-checked="true"');
    expect(tag(html, "theme-selector-dark")).toContain('aria-checked="false"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  });

  it("follows the store-or-controlled selection", () => {
    expect(tag(renderToStaticMarkup(<ThemeSelector value="system" />), "theme-selector-system")).toContain(
      'aria-checked="true"',
    );
    expect(tag(renderToStaticMarkup(<ThemeSelector value="dark" />), "theme-selector-dark")).toContain(
      'aria-checked="true"',
    );
  });

  it("keeps each radio's role and accessible name", () => {
    const html = renderToStaticMarkup(<ThemeSelector value="system" />);

    const system = tag(html, "theme-selector-system");
    expect(system).toContain('role="radio"');
    expect(system).toContain('aria-label="System"');
    expect(tag(html, "theme-selector-dark")).toContain('aria-label="Dark"');
  });

  it("keeps the radiogroup's accessible name", () => {
    const html = renderToStaticMarkup(<ThemeSelector value="system" accessibilityLabel="Appearance" />);

    const group = tag(html, "theme-selector");
    expect(group).toContain('role="radiogroup"');
    expect(group).toContain('aria-label="Appearance"');
  });

  it("names the radiogroup from the row title inside an Item", () => {
    const html = renderToStaticMarkup(
      <Item>
        <ItemContent>
          <ItemTitle>Theme</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ThemeSelector value="system" />
        </ItemActions>
      </Item>,
    );

    expect(tag(html, "theme-selector")).toContain('aria-label="Theme"');
  });
});
