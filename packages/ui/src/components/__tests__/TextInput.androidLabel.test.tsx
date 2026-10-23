/**
 * Android `TextInput`: the visible label is hidden from TalkBack only when the
 * installed `@expo/ui` can name the native field.
 *
 * The field's name is a Compose `semantics({ contentDescription })` modifier,
 * which `@expo/ui` accepts from 57.0.21 (57.x) and 58.0.8 (58.x). Below that
 * the param is dropped natively, so hiding the label would leave TalkBack with
 * nothing to read. The support flag is computed when `TextInput` loads, so each
 * case mocks the peer's `package.json` and loads the component fresh. As in
 * `TextInput.android.test.tsx`, the native field is a pass-through mock because
 * Jest resolves the iOS variant for a bare `../nativeTextField` import.
 */
import type { ReactElement } from "react";

jest.mock("@expo/ui", () => {
  const React = require("react") as typeof import("react");
  return {
    Host: ({ children }: { children: React.ReactNode }) =>
      React.createElement("MockComposeHost", null, children),
    TextInput: (props: object) =>
      React.createElement("MockComposeTextInput", { testID: "compose-input", ...props }),
    useNativeState: (initial: string) => React.useRef({ value: initial }).current,
  };
});

jest.mock("../nativeTextField", () => {
  const React = require("react") as typeof import("react");
  const { TextInput } = require("@expo/ui");
  return {
    __esModule: true,
    NativeTextField: (props: object) => React.createElement(TextInput, props),
  };
});

const cleanups: Array<() => unknown> = [];

/**
 * Loads RNTL and `TextInput` together, fresh, against a given `@expo/ui`
 * version. The `pure` entry registers no auto-cleanup hooks (its main entry
 * cannot be required inside a test), so the case unmounts through `cleanup`.
 */
function loadWithExpoUi(version: string | undefined, os: "android" | "ios" = "android") {
  jest.resetModules();
  if (version === undefined) {
    jest.doMock("@expo/ui/package.json", () => {
      throw new Error("not resolvable");
    });
  } else {
    jest.doMock("@expo/ui/package.json", () => ({ version }));
  }
  // `resetModules` also reloads react-native; the platform is set on that copy.
  (require("react-native") as typeof import("react-native")).Platform.OS = os;
  const { render, cleanup } = require("@testing-library/react-native/pure") as typeof import("@testing-library/react-native");
  const { TextInput } = require("../TextInput") as typeof import("../TextInput");
  cleanups.push(cleanup);
  return {
    renderInput: (element: (input: typeof TextInput) => ReactElement) => render(element(TextInput)),
  };
}

describe("TextInput Android label accessibility", () => {
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
    jest.dontMock("@expo/ui/package.json");
  });

  it.each(["57.0.21", "58.0.8", "58.0.16", "59.0.0"])(
    "hides the visible label when @expo/ui %s names the native field",
    async (version) => {
      const { renderInput } = loadWithExpoUi(version);
      const screen = await renderInput((TextInput) => <TextInput label="Email" />);

      expect(screen.getByTestId("compose-input").props.accessibilityLabel).toBe("Email");
      const label = screen.getByText("Email", { includeHiddenElements: true });
      expect(screen.queryByText("Email")).toBeNull();
      expect(label.parent?.props.accessibilityElementsHidden).toBe(true);
      expect(label.parent?.props.importantForAccessibility).toBe("no-hide-descendants");
    }
  );

  it.each(["56.0.26", "57.0.4", "57.0.20", "58.0.7"])(
    "keeps the visible label readable when @expo/ui %s drops contentDescription",
    async (version) => {
      const { renderInput } = loadWithExpoUi(version);
      const screen = await renderInput((TextInput) => <TextInput label="Email" />);

      // Still handed to the native field; the old native module ignores it.
      expect(screen.getByTestId("compose-input").props.accessibilityLabel).toBe("Email");
      const label = screen.getByText("Email");
      expect(label.parent?.props.accessibilityElementsHidden).toBe(false);
      expect(label.parent?.props.importantForAccessibility).toBe("auto");
    }
  );

  it("keeps the visible label readable when the @expo/ui version cannot be read", async () => {
    const { renderInput } = loadWithExpoUi(undefined);
    const screen = await renderInput((TextInput) => <TextInput label="Email" />);

    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("still hides the visible label on iOS whatever the @expo/ui version", async () => {
    const { renderInput } = loadWithExpoUi("57.0.4", "ios");
    const screen = await renderInput((TextInput) => <TextInput label="Email" />);

    expect(screen.getByText("Email", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("Email")).toBeNull();
  });
});
