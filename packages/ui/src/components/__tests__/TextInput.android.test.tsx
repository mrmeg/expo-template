import React, { type ComponentProps, type ComponentRef } from "react";
import { Platform, TextInput as RNTextInput } from "react-native";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { TextInput } from "../TextInput";
import { dismissKeyboardFocusedInput, hasKeyboardFocusedInput } from "../keyboardFocusRegistry";

type NativeProps = {
  value: { value: string };
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onChangeText?: (text: string) => void;
  onSelectionChange?: (event: { nativeEvent: { selection: Selection } }) => void;
};
type Selection = { start: number; end: number };
type NativeInput = {
  mounted: boolean;
  focused: boolean;
  selection: Selection;
  props: NativeProps;
  refs: Set<unknown>;
  focus: jest.Mock;
  blur: jest.Mock;
  isFocused: jest.Mock;
};

// Model native lifetime, not an RN TextInput mock: focus and selection belong to
// a mounted Compose field, while the shared NativeState buffer survives remounts.
jest.mock("@expo/ui", () => {
  const React = require("react") as typeof import("react");
  const hosts: object[] = [];
  const unmountedHosts: object[] = [];
  const inputs: NativeInput[] = [];
  const unmountedInputs: NativeInput[] = [];

  function Host({ children }: { children: React.ReactNode }) {
    const [identity] = React.useState(() => ({}));
    React.useEffect(() => {
      hosts.push(identity);
      return () => { unmountedHosts.push(identity); };
    }, [identity]);
    return React.createElement("MockComposeHost", { testID: "compose-host" }, children);
  }

  const TextInput = React.forwardRef(function MockComposeTextInput(props: NativeProps, ref) {
    const [instance] = React.useState<NativeInput>(() => {
      const input: NativeInput = {
        mounted: false,
        focused: false,
        selection: { start: 0, end: 0 },
        props,
        refs: new Set(),
        focus: jest.fn(() => {
          if (!input.mounted || input.focused) return;
          input.focused = true;
          input.props.onFocus?.();
        }),
        blur: jest.fn(() => {
          if (!input.mounted || !input.focused) return;
          input.focused = false;
          input.props.onBlur?.();
        }),
        isFocused: jest.fn(() => input.mounted && input.focused),
      };
      return input;
    });
    instance.props = props;
    instance.refs.add(ref);
    React.useImperativeHandle(ref, () => instance, [instance]);
    React.useEffect(() => {
      inputs.push(instance);
      instance.mounted = true;
      if (instance.props.autoFocus) instance.focus();
      return () => {
        instance.mounted = false;
        instance.focused = false;
        unmountedInputs.push(instance);
      };
    }, [instance]);

    return React.createElement("MockComposeTextInput", {
      testID: "compose-input",
      onFocus: instance.focus,
      onBlur: instance.blur,
      onSelectionChange: (event: { nativeEvent: { selection: Selection } }) => {
        instance.selection = event.nativeEvent.selection;
        instance.props.onSelectionChange?.(event);
      },
      onChangeText: (text: string) => {
        if (!instance.mounted || !instance.focused) throw new Error("Typing requires a focused field");
        instance.props.value.value = text;
        instance.selection = { start: text.length, end: text.length };
        instance.props.onChangeText?.(text);
      },
    });
  });

  return {
    Host,
    TextInput,
    useNativeState: (initial: string) => React.useRef({ value: initial }).current,
    lifecycle: { hosts, unmountedHosts, inputs, unmountedInputs },
  };
});

const { lifecycle } = jest.requireMock("@expo/ui") as {
  lifecycle: {
    hosts: object[];
    unmountedHosts: object[];
    inputs: NativeInput[];
    unmountedInputs: NativeInput[];
  };
};

function expectSameField(input: NativeInput, host: object) {
  expect(screen.getAllByTestId("compose-host")).toHaveLength(1);
  expect(screen.getAllByTestId("compose-input")).toHaveLength(1);
  expect(lifecycle.hosts).toHaveLength(1);
  expect(lifecycle.hosts[0]).toBe(host);
  expect(lifecycle.inputs).toHaveLength(1);
  expect(lifecycle.inputs[0]).toBe(input);
  expect(lifecycle.unmountedHosts).toHaveLength(0);
  expect(lifecycle.unmountedInputs).toHaveLength(0);
  expect(input.mounted).toBe(true);
  expect(input.refs.size).toBe(1);
}

async function pressToggle(label: "Show password" | "Hide password") {
  await fireEvent.press(screen.getByLabelText(label));
  // Also catch delayed refocus workarounds; Android needs no focus handoff.
  await act(async () => { jest.runOnlyPendingTimers(); });
}

describe("TextInput Android native identity", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
    jest.useFakeTimers();
    for (const records of Object.values(lifecycle)) records.length = 0;
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    Platform.OS = originalOS;
  });

  it("keeps one focused host/input through show/hide/show and subsequent typing", async () => {
    const onChangeText = jest.fn();
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(
      <TextInput
        secureTextEntry showSecureEntryToggle defaultValue="secret"
        onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur}
      />
    );
    const host = lifecycle.hosts[0];
    const input = lifecycle.inputs[0];
    const buffer = input.props.value;
    await fireEvent(screen.getByTestId("compose-input"), "focus");

    for (const label of ["Show password", "Hide password", "Show password"] as const) {
      const selection = { start: 2, end: 4 };
      await fireEvent(screen.getByTestId("compose-input"), "selectionChange", {
        nativeEvent: { selection },
      });
      const previous = buffer.value;
      await pressToggle(label);

      expectSameField(input, host);
      expect(input.focused).toBe(true);
      expect(input.selection).toEqual(selection);
      expect(input.props.value).toBe(buffer);
      expect(buffer.value).toBe(previous);
      expect(input.props.secureTextEntry).toBe(label === "Hide password");

      // Replace the selected range, as the still-focused native editor would.
      const next = previous.slice(0, selection.start) + "x" + previous.slice(selection.end);
      await fireEvent.changeText(screen.getByTestId("compose-input"), next);
      expect(buffer.value).toBe(next);
      expect(onChangeText).toHaveBeenLastCalledWith(next);
      expect(input.selection).toEqual({ start: next.length, end: next.length });
    }
    expect(input.focus).toHaveBeenCalledTimes(1);
    expect(input.blur).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();

    await cleanup();
    expect(lifecycle.unmountedHosts).toEqual([host]);
    expect(lifecycle.unmountedInputs).toEqual([input]);
    expect(hasKeyboardFocusedInput()).toBe(false);
  });

  it("keeps the same editor and ref through controlled value and secureTextEntry changes", async () => {
    const ref = React.createRef<ComponentRef<typeof RNTextInput>>();
    const onChangeText = jest.fn();
    const field = (props: ComponentProps<typeof TextInput>) => (
      <TextInput ref={ref} onChangeText={onChangeText} showSecureEntryToggle {...props} />
    );
    await render(field({ value: "secret", secureTextEntry: true }));
    const host = lifecycle.hosts[0];
    const input = lifecycle.inputs[0];
    const handle = ref.current!;
    const buffer = input.props.value;
    await act(async () => { handle.focus(); });

    for (const props of [
      { value: "reset", secureTextEntry: false },
      { value: "", secureTextEntry: true, showSecureEntryToggle: false },
      { value: "restored", secureTextEntry: undefined },
      { value: "restored", secureTextEntry: true },
    ]) {
      await screen.rerender(field(props));
      expectSameField(input, host);
      expect(ref.current).toBe(handle);
      expect(handle.isFocused()).toBe(true);
      expect(input.props.value).toBe(buffer);
      expect(buffer.value).toBe(props.value);
      expect(input.props.secureTextEntry).toBe(!!props.secureTextEntry);
    }
    expect(onChangeText).not.toHaveBeenCalled();
    await pressToggle("Show password");
    await fireEvent.changeText(screen.getByTestId("compose-input"), "restoredx");
    await screen.rerender(field({ value: "restoredx", secureTextEntry: true }));
    expectSameField(input, host);
    expect(input.props.secureTextEntry).toBe(false);
    expect(buffer.value).toBe("restoredx");
    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith("restoredx");
    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it("routes imperative methods and registered dismissal to the stable native ref", async () => {
    const ref = React.createRef<ComponentRef<typeof RNTextInput>>();
    const onBlur = jest.fn();
    await render(<TextInput ref={ref} secureTextEntry showSecureEntryToggle onBlur={onBlur} />);
    const host = lifecycle.hosts[0];
    const input = lifecycle.inputs[0];
    const handle = ref.current!;

    for (const label of ["Show password", "Hide password", "Show password"] as const) {
      await act(async () => { handle.focus(); });
      await pressToggle(label);
      expectSameField(input, host);
      expect(ref.current).toBe(handle);
      expect(handle.isFocused()).toBe(true);
      expect(hasKeyboardFocusedInput()).toBe(true);
      await act(async () => { handle.setNativeProps({ text: label }); });
      expect(input.props.value.value).toBe(label);
      await act(async () => { handle.clear(); });
      expect(input.props.value.value).toBe("");

      await act(async () => { handle.blur(); });
      expect(handle.isFocused()).toBe(false);
      expect(hasKeyboardFocusedInput()).toBe(false);
      await act(async () => { handle.focus(); });
      await act(async () => { expect(dismissKeyboardFocusedInput()).toBe(true); });
      expect(handle.isFocused()).toBe(false);
      expect(hasKeyboardFocusedInput()).toBe(false);
    }
    expect(input.focus).toHaveBeenCalledTimes(6);
    expect(input.blur).toHaveBeenCalledTimes(6);
    expect(onBlur).toHaveBeenCalledTimes(6);
  });

  it.each([false, true])("does not focus an unfocused toggle (initial autoFocus=%s)", async (autoFocus) => {
    const onFocus = jest.fn();
    await render(
      <TextInput secureTextEntry showSecureEntryToggle autoFocus={autoFocus} onFocus={onFocus} />
    );
    const host = lifecycle.hosts[0];
    const input = lifecycle.inputs[0];
    if (autoFocus) await fireEvent(screen.getByTestId("compose-input"), "blur");

    for (const label of ["Show password", "Hide password", "Show password"] as const) {
      await pressToggle(label);
      expectSameField(input, host);
      expect(input.focused).toBe(false);
      expect(input.focus).toHaveBeenCalledTimes(autoFocus ? 1 : 0);
      expect(onFocus).toHaveBeenCalledTimes(autoFocus ? 1 : 0);
      expect(hasKeyboardFocusedInput()).toBe(false);
    }
  });
});
