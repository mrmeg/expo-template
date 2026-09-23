/**
 * Web `<html data-theme>` sync.
 *
 * `getThemeCssVariables()` keys every `--c-*` variable on `html[data-theme]`,
 * so the attribute must follow the store's resolved scheme. That used to be
 * an effect in every `useTheme` consumer, re-run in each of them on every
 * scheme switch; it is now one store subscription for the app, started by the
 * first consumer to mount and writing only when the resolved scheme changes.
 *
 * Its own file: the sync is module state, and jest-expo has no DOM, so this
 * file installs a minimal `document` that records writes.
 */
import React from "react";
import { Platform } from "react-native";
import { act, render } from "@testing-library/react-native";
import { useTheme } from "../useTheme";
import { useThemeStore } from "../../state/themeStore";

const themeWrites: string[] = [];
const colorSchemeWrites: string[] = [];
const originalOS = Platform.OS;

function recordingProperty(target: object, key: string, writes: string[]) {
  Object.defineProperty(target, key, {
    configurable: true,
    get: () => writes[writes.length - 1],
    set: (value: string) => {
      writes.push(value);
    },
  });
}

beforeAll(() => {
  const dataset = {};
  const style = {};
  recordingProperty(dataset, "theme", themeWrites);
  recordingProperty(style, "colorScheme", colorSchemeWrites);
  (globalThis as { document?: unknown }).document = { documentElement: { dataset, style } };
  Platform.OS = "web";
});

afterAll(() => {
  delete (globalThis as { document?: unknown }).document;
  Platform.OS = originalOS;
});

function Consumer() {
  useTheme();
  return null;
}

describe("useTheme document sync (web)", () => {
  it("writes data-theme once per resolved-scheme change, not once per consumer", async () => {
    useThemeStore.setState({ userTheme: "system", systemTheme: "light" });

    const { rerender } = await render(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
      </>
    );

    // The first consumer to mount writes the current scheme; the rest don't.
    expect(themeWrites).toEqual(["light"]);
    expect(colorSchemeWrites).toEqual(["light"]);

    await act(() => {
      useThemeStore.getState().setSystemTheme("dark");
    });
    expect(themeWrites).toEqual(["light", "dark"]);
    expect(colorSchemeWrites).toEqual(["light", "dark"]);

    // Store changes that leave the resolved scheme alone write nothing.
    await act(() => {
      useThemeStore.getState().setFonts({ families: { mono: { regular: "Mono" } } });
      useThemeStore.getState().setTheme("dark");
    });
    expect(themeWrites).toEqual(["light", "dark"]);

    // More consumers mounting later don't write either.
    await rerender(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
        <Consumer />
      </>
    );
    expect(themeWrites).toEqual(["light", "dark"]);

    await act(() => {
      useThemeStore.getState().setTheme("light");
    });
    expect(themeWrites).toEqual(["light", "dark", "light"]);
    expect(colorSchemeWrites).toEqual(["light", "dark", "light"]);

    useThemeStore.getState().setFonts({});
  });
});
