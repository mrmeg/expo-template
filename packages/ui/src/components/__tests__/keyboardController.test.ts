/**
 * Tests for the keyboard-controller indirection module.
 *
 * Two variants ship: `keyboardController.native.ts` re-exports the real
 * package, `keyboardController.ts` is the inert web stub. Jest runs on a native
 * platform, so a bare `../keyboardController` import resolves the native
 * variant here — the web stub is loaded through its explicit filename so both
 * halves can be asserted in one suite.
 */
import React from "react";
import { View } from "react-native";
import { render } from "@testing-library/react-native";
import * as nativeVariant from "../keyboardController";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type KeyboardControllerModuleShape = typeof import("../keyboardController");

const webVariant = require("../keyboardController.ts") as KeyboardControllerModuleShape;

const EXPECTED_EXPORTS = [
  "KeyboardController",
  "NativeKeyboardAvoidingView",
  "useKeyboardContext",
  "useKeyboardState",
];

function moduleExportNames(module: object) {
  return Object.keys(module)
    .filter((name) => name !== "__esModule" && name !== "default")
    .sort();
}

describe("keyboardController indirection", () => {
  it("resolves the native variant under a native platform", () => {
    // The native re-export is what keeps `KeyboardController.dismiss()` and the
    // hooks real on iOS/Android; the global jest mock stands in for the module.
    expect(moduleExportNames(nativeVariant)).toEqual(EXPECTED_EXPORTS);
    expect(typeof nativeVariant.KeyboardController.dismiss).toBe("function");
    expect(typeof nativeVariant.useKeyboardState).toBe("function");
    expect(typeof nativeVariant.useKeyboardContext).toBe("function");
    expect(nativeVariant.NativeKeyboardAvoidingView).toBeTruthy();
  });

  it("exports the same names from both variants", () => {
    expect(moduleExportNames(webVariant)).toEqual(moduleExportNames(nativeVariant));
  });
});

describe("keyboardController web stub", () => {
  it("treats KeyboardController as a no-op module", async () => {
    await expect(webVariant.KeyboardController.dismiss()).resolves.toBeUndefined();
    expect(webVariant.KeyboardController.isVisible()).toBe(false);
    expect(webVariant.KeyboardController.state().height).toBe(0);
    expect(() => {
      webVariant.KeyboardController.setDefaultMode();
      webVariant.KeyboardController.setInputMode(0);
      webVariant.KeyboardController.preload();
      webVariant.KeyboardController.setFocusTo("next");
    }).not.toThrow();
  });

  it("reports a permanently hidden keyboard through useKeyboardState", () => {
    expect(webVariant.useKeyboardState((state) => state.isVisible)).toBe(false);
    expect(webVariant.useKeyboardState((state) => state.height)).toBe(0);
    expect(webVariant.useKeyboardState()).toMatchObject({ isVisible: false, height: 0 });
  });

  it("returns a stable, empty focused-input layout from useKeyboardContext", () => {
    const first = webVariant.useKeyboardContext();
    const second = webVariant.useKeyboardContext();

    // `DismissKeyboard` reads `layout.value` and puts the context object in a
    // `useCallback` dependency list, so identity has to stay stable.
    expect(first).toBe(second);
    expect(first.layout.value).toBeNull();
  });

  it("renders NativeKeyboardAvoidingView as a plain View passthrough", async () => {
    const { getByTestId, queryByTestId } = await render(
      React.createElement(
        webVariant.NativeKeyboardAvoidingView,
        {
          testID: "avoiding-view",
          style: { flex: 1 },
          behavior: "padding",
          automaticOffset: true,
          keyboardVerticalOffset: 24,
          contentContainerStyle: { flexGrow: 1 },
        },
        React.createElement(View, { testID: "child" })
      )
    );

    expect(getByTestId("child")).toBeTruthy();
    expect(queryByTestId("avoiding-view")).toBeTruthy();
    // Keyboard-only props must not survive onto the rendered view.
    expect(getByTestId("avoiding-view").props).not.toHaveProperty("behavior");
    expect(getByTestId("avoiding-view").props).not.toHaveProperty("keyboardVerticalOffset");
  });

  it("calls no hooks, so it is safe from any call site", () => {
    // A stub that called hooks conditionally would break rules of hooks in the
    // components that mount only on native.
    const source = readFileSync(join(__dirname, "../keyboardController.ts"), "utf8");

    expect(source).not.toMatch(/\buse(State|Effect|Memo|Callback|Context|SyncExternalStore)\s*\(/);
  });
});

describe("packages/ui keyboard imports", () => {
  const componentsDir = join(__dirname, "..");

  it.each([
    "KeyboardAvoidingView.tsx",
    "DismissKeyboard.tsx",
    "BottomSheet.tsx",
  ])("keeps %s off a runtime react-native-keyboard-controller import", (file) => {
    const source = readFileSync(join(componentsDir, file), "utf8");
    const runtimeImport = /^\s*import\s+(?!type\b)[^;]*from\s+"react-native-keyboard-controller";/m;

    // A value import here drags the package (and its animation runtime) into
    // the web bundle even when the component branches away from it at runtime.
    expect(source).not.toMatch(runtimeImport);
    expect(source).toMatch(/from "\.\/keyboardController"/);
  });

  it("keeps the type-only import in keyboardFocusRegistry", () => {
    const source = readFileSync(join(componentsDir, "keyboardFocusRegistry.ts"), "utf8");

    expect(source).toMatch(
      /import type \{ FocusedInputLayoutChangedEvent \} from "react-native-keyboard-controller";/
    );
  });
});
