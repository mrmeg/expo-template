/**
 * Tests for the package-owned Android native text field.
 *
 * jest-expo runs as iOS, so a bare `../nativeTextField` import resolves the
 * default variant (the `@expo/ui` re-export the global setup mocks). The Android
 * variant is loaded through its explicit filename and rendered against
 * recording mocks of `@expo/ui/jetpack-compose` and its modifiers: no Compose
 * native module is involved, the assertions read the props the field hands to
 * `BasicTextField`.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TextProps, TextStyle, ViewProps } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { TextInput as ExpoTextInput, type TextInputRef } from "@expo/ui";
import type { BasicTextFieldProps, TextFieldRef } from "@expo/ui/jetpack-compose";
import { NativeTextField as DefaultNativeTextField } from "../nativeTextField";
import { NativeTextField, type NativeTextFieldProps } from "../nativeTextField.android";

type Handle = { [K in keyof TextFieldRef]: jest.Mock };
type RecordedProps = BasicTextFieldProps & { ref?: React.Ref<TextFieldRef> };
type RecordedField = { props: RecordedProps; handle: Handle };

jest.mock("@expo/ui/jetpack-compose", () => {
  const React = require("react") as typeof import("react");
  const { View, Text: RNText } = require("react-native") as typeof import("react-native");
  const fields: RecordedField[] = [];

  function BasicTextField(props: RecordedProps) {
    const [field] = React.useState<RecordedField>(() => ({
      props,
      handle: {
        setText: jest.fn(() => Promise.resolve()),
        clear: jest.fn(() => Promise.resolve()),
        focus: jest.fn(() => Promise.resolve()),
        blur: jest.fn(() => Promise.resolve()),
        setSelection: jest.fn(() => Promise.resolve()),
      },
    }));
    field.props = props;
    React.useImperativeHandle(props.ref, () => field.handle, [field]);
    React.useEffect(() => {
      fields.push(field);
      return () => {
        fields.splice(fields.indexOf(field), 1);
      };
    }, [field]);
    return React.createElement(View, { testID: "basic-text-field" }, props.children);
  }
  BasicTextField.DecorationBox = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: "decoration-box" }, children);
  BasicTextField.Placeholder = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: "placeholder" }, children);
  BasicTextField.InnerTextField = () => React.createElement(View, { testID: "inner-text-field" });

  const Box = ({
    children,
    contentAlignment,
    modifiers,
  }: { children?: React.ReactNode; contentAlignment?: string; modifiers?: unknown[] }) =>
    React.createElement(View, { testID: "box", contentAlignment, modifiers } as ViewProps, children);
  const Text = ({
    children,
    color,
    style,
    modifiers,
  }: { children?: React.ReactNode; color?: string; style?: TextStyle; modifiers?: unknown[] }) =>
    React.createElement(RNText, { testID: "compose-text", color, style, modifiers } as TextProps, children);
  const useNativeState = (initial: unknown) => React.useRef({ value: initial }).current;

  return { __esModule: true, BasicTextField, Box, Text, useNativeState, __fields: fields };
});

jest.mock("@expo/ui/jetpack-compose/modifiers", () => ({
  __esModule: true,
  fillMaxWidth: (fraction?: number) => ({ $type: "fillMaxWidth", fraction }),
  onSizeChanged: (handler: unknown) => ({ $type: "onSizeChanged", handler }),
  semantics: (params: { contentType?: string }) => ({ $type: "semantics", ...params }),
  testID: (tag: string) => ({ $type: "testID", testID: tag }),
  padding: (start: number, top: number, end: number, bottom: number) => ({
    $type: "padding",
    start,
    top,
    end,
    bottom,
  }),
  paddingAll: (all: number) => ({ $type: "paddingAll", all }),
}));

const { __fields: fields } = jest.requireMock("@expo/ui/jetpack-compose") as {
  __fields: RecordedField[];
};

const PASSWORD_KEYBOARD = { keyboardType: "password", capitalization: "none", autoCorrectEnabled: false };

/** The single mounted Compose field. */
function field(): RecordedField {
  expect(fields).toHaveLength(1);
  return fields[0];
}

beforeEach(() => {
  fields.length = 0;
});

describe("NativeTextField (Android) keyboard options", () => {
  it("declares a password keyboard for a secure field", async () => {
    await render(<NativeTextField secureTextEntry />);

    expect(field().props.keyboardOptions).toEqual(PASSWORD_KEYBOARD);
    expect(field().props.visualTransformation).toBe("password");
  });

  it("keeps the password keyboard when the same field is revealed", async () => {
    await render(<NativeTextField secureTextEntry />);
    const secure = field();

    // The eye toggle flips `secureTextEntry` on the mounted element: only the
    // masking may change, or Compose restarts the IME and drops the selection.
    await screen.rerender(<NativeTextField secureTextEntry={false} />);
    expect(field()).toBe(secure);
    expect(secure.props.keyboardOptions).toEqual(PASSWORD_KEYBOARD);
    expect(secure.props.visualTransformation).toBeUndefined();

    await screen.rerender(<NativeTextField secureTextEntry />);
    expect(field()).toBe(secure);
    expect(secure.props.keyboardOptions).toEqual(PASSWORD_KEYBOARD);
    expect(secure.props.visualTransformation).toBe("password");
  });

  it.each<NonNullable<NativeTextFieldProps["keyboardType"]>>([
    "number-pad",
    "decimal-pad",
    "numeric",
    "phone-pad",
  ])("uses numberPassword for a secure %s keyboard", async (keyboardType) => {
    await render(<NativeTextField secureTextEntry keyboardType={keyboardType} />);

    expect(field().props.keyboardOptions).toEqual({ ...PASSWORD_KEYBOARD, keyboardType: "numberPassword" });
  });

  it("derives numberPassword from a numeric inputMode too", async () => {
    await render(<NativeTextField secureTextEntry inputMode="numeric" />);

    expect(field().props.keyboardOptions?.keyboardType).toBe("numberPassword");
  });

  it("lets explicit autoCorrect and autoCapitalize win on a secure field", async () => {
    await render(<NativeTextField secureTextEntry autoCorrect autoCapitalize="characters" returnKeyType="done" />);

    expect(field().props.keyboardOptions).toEqual({
      keyboardType: "password",
      capitalization: "characters",
      autoCorrectEnabled: true,
      imeAction: "done",
    });
  });

  it("passes no keyboard options or transformation for a plain field", async () => {
    await render(<NativeTextField />);

    expect(field().props.keyboardOptions).toBeUndefined();
    expect(field().props.visualTransformation).toBeUndefined();
  });

  it("maps a plain keyboardType like the universal field", async () => {
    await render(<NativeTextField keyboardType="email-address" />);

    expect(field().props.keyboardOptions).toEqual({ keyboardType: "email" });
  });

  it("maps returnKeyType and enterKeyHint to an IME action", async () => {
    await render(<NativeTextField returnKeyType="google" />);
    expect(field().props.keyboardOptions).toEqual({ imeAction: "search" });

    await screen.rerender(<NativeTextField enterKeyHint="enter" />);
    expect(field().props.keyboardOptions).toEqual({ imeAction: "default" });
  });

  it("attaches onSubmitEditing to every IME action", async () => {
    const onSubmitEditing = jest.fn();
    await render(<NativeTextField onSubmitEditing={onSubmitEditing} />);

    expect(field().props.keyboardActions).toEqual({
      onDone: onSubmitEditing,
      onGo: onSubmitEditing,
      onNext: onSubmitEditing,
      onSearch: onSubmitEditing,
      onSend: onSubmitEditing,
      onPrevious: onSubmitEditing,
    });

    await screen.rerender(<NativeTextField />);
    expect(field().props.keyboardActions).toBeUndefined();
  });
});

describe("NativeTextField (Android) modifiers", () => {
  it("maps box padding, testID, autoComplete and size changes in the universal order", async () => {
    const onContentSizeChange = jest.fn();
    const user = { $type: "user" };
    await render(
      <NativeTextField
        modifiers={[user]}
        style={{ backgroundColor: "transparent", paddingHorizontal: 12, paddingVertical: 8 }}
        testID="password-field"
        autoComplete="password"
        onContentSizeChange={onContentSizeChange}
      />
    );

    expect(field().props.modifiers).toEqual([
      user,
      { $type: "padding", start: 12, top: 8, end: 12, bottom: 8 },
      { $type: "testID", testID: "password-field" },
      { $type: "semantics", contentType: "password" },
      { $type: "onSizeChanged", handler: onContentSizeChange },
    ]);
  });

  it("collapses uniform padding, lets sides override shorthands, and drops zero padding", async () => {
    await render(<NativeTextField style={{ padding: 10 }} />);
    expect(field().props.modifiers).toEqual([{ $type: "paddingAll", all: 10 }]);

    await screen.rerender(<NativeTextField style={{ padding: 10, paddingTop: 2, paddingHorizontal: 4 }} />);
    expect(field().props.modifiers).toEqual([{ $type: "padding", start: 4, top: 2, end: 4, bottom: 10 }]);

    // The RN wrapper paints the surface; a fill alone yields no modifier.
    await screen.rerender(<NativeTextField style={{ backgroundColor: "red" }} />);
    expect(field().props.modifiers).toEqual([]);
  });
});

describe("NativeTextField (Android) focus and ref", () => {
  it("reports focus changes through onFocus/onBlur and tracks isFocused", async () => {
    const ref = React.createRef<TextInputRef>();
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<NativeTextField ref={ref} onFocus={onFocus} onBlur={onBlur} />);
    expect(ref.current?.isFocused()).toBe(false);

    await act(async () => {
      field().props.onFocusChanged?.(true);
    });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();
    expect(ref.current?.isFocused()).toBe(true);

    await act(async () => {
      field().props.onFocusChanged?.(false);
    });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(ref.current?.isFocused()).toBe(false);
  });

  it("delegates focus, blur, clear and setSelection to the Compose field", async () => {
    const ref = React.createRef<TextInputRef>();
    await render(<NativeTextField ref={ref} />);
    const { handle } = field();

    ref.current?.focus();
    ref.current?.blur();
    ref.current?.clear();
    await expect(ref.current?.setSelection(1, 3)).resolves.toBeUndefined();

    expect(handle.focus).toHaveBeenCalledTimes(1);
    expect(handle.blur).toHaveBeenCalledTimes(1);
    expect(handle.clear).toHaveBeenCalledTimes(1);
    expect(handle.setSelection).toHaveBeenCalledWith(1, 3);
  });

  it("selects the whole buffer on focus when selectTextOnFocus is set", async () => {
    await render(<NativeTextField selectTextOnFocus defaultValue="secret" />);

    await act(async () => {
      field().props.onFocusChanged?.(true);
    });
    expect(field().handle.setSelection).toHaveBeenCalledWith(0, 6);
  });
});

describe("NativeTextField (Android) field parity", () => {
  it("renders the placeholder inside the decoration box with color and alignment", async () => {
    await render(<NativeTextField placeholder="Email" placeholderTextColor="#888888" textAlign="center" />);

    expect(screen.getByTestId("decoration-box")).toBeTruthy();
    expect(screen.getByTestId("placeholder")).toBeTruthy();
    expect(screen.getByTestId("inner-text-field")).toBeTruthy();
    expect(screen.getByTestId("box").props.contentAlignment).toBe("topCenter");
    const text = screen.getByTestId("compose-text");
    expect(text.props.color).toBe("#888888");
    expect(text.props.style).toEqual({ textAlign: "center" });
    expect(field().props.textStyle).toEqual({ textAlign: "center" });
  });

  it("omits the placeholder slot when there is no placeholder", async () => {
    await render(<NativeTextField />);

    expect(screen.queryByTestId("placeholder")).toBeNull();
    expect(screen.getByTestId("inner-text-field")).toBeTruthy();
    expect(field().props.textStyle).toBeUndefined();
  });

  it("binds the shared buffer and maps multiline, editable, maxLength and textStyle", async () => {
    const value = { value: "hello" };
    await render(
      <NativeTextField
        value={value}
        multiline
        rows={3}
        editable={false}
        maxLength={20}
        textStyle={{ fontSize: 16, color: "#000000" }}
      />
    );

    const props = field().props;
    expect(props.value).toBe(value);
    expect(props.singleLine).toBe(false);
    expect(props.maxLines).toBe(3);
    expect(props.minLines).toBe(3);
    expect(props.readOnly).toBe(true);
    expect(props.maxLength).toBe(20);
    expect(props.textStyle).toEqual({ fontSize: 16, color: "#000000" });
  });

  it("seeds the fallback buffer from defaultValue and forwards onChangeText", async () => {
    const onChangeText = jest.fn();
    await render(<NativeTextField defaultValue="seed" onChangeText={onChangeText} readOnly />);

    const props = field().props;
    expect(props.value).toEqual({ value: "seed" });
    expect(props.onValueChange).toBe(onChangeText);
    expect(props.singleLine).toBe(true);
    expect(props.maxLines).toBeUndefined();
    expect(props.readOnly).toBe(true);
  });

  it("hides the caret and maps selection colors", async () => {
    await render(<NativeTextField caretHidden selectionColor="#00ff00" selectionHandleColor="#0000ff" />);

    expect(field().props.cursorColor).toBe("transparent");
    expect(field().props.textSelectionColors).toEqual({
      handleColor: "#0000ff",
      backgroundColor: "#00ff00",
    });
  });
});

describe("nativeTextField platform split", () => {
  it("re-exports @expo/ui's TextInput from the default variant", () => {
    expect(DefaultNativeTextField).toBe(ExpoTextInput);
  });

  it("is the only route from TextInput.tsx to the native field", () => {
    const source = readFileSync(join(__dirname, "../TextInput.tsx"), "utf8");

    expect(source).toMatch(/from "\.\/nativeTextField"/);
    expect(source).not.toMatch(/TextInput as ExpoTextInput/);
  });
});
