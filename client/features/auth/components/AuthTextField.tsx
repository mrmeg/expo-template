import React, {
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextInput as RNTextInput } from "react-native";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";

/**
 * AuthTextField is intentionally an *uncontrolled* input: the live text lives in
 * the native field and is mirrored into `valueRef`, not React state. This avoids
 * the controlled-`value` round-trip (re-render -> push string back into the
 * native buffer) that causes cursor flicker on auth screens while typing. The
 * only state that triggers a re-render is `errorText`. Parents read/write the
 * value through the imperative handle (`getValue`/`setValue`).
 */

type TextInputProps = React.ComponentProps<typeof TextInput>;

export interface AuthTextFieldHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  validate: () => boolean;
  hasError: () => boolean;
}

interface AuthTextFieldProps
  extends Omit<TextInputProps, "error" | "errorText" | "onChangeText" | "value" | "ref"> {
  initialValue?: string;
  normalize?: (value: string) => string;
  onValueChange?: (value: string, handle: AuthTextFieldHandle) => void;
  validateValue?: (value: string) => string;
  ref?: React.Ref<AuthTextFieldHandle>;
}

function AuthTextFieldComponent({
  initialValue = "",
  normalize,
  onValueChange,
  validateValue,
  onBlur,
  ref,
  ...props
}: AuthTextFieldProps) {
  const inputRef = useRef<RNTextInput>(null);
  const valueRef = useRef(initialValue);
  const errorTextRef = useRef("");
  const [errorText, setErrorText] = useState("");

  const validate = useCallback(
    (nextValue = valueRef.current) => {
      const nextError = validateValue?.(nextValue) ?? "";
      errorTextRef.current = nextError;
      setErrorText((current) => (current === nextError ? current : nextError));
      return nextError.length === 0;
    },
    [validateValue],
  );

  // Push text into the uncontrolled native field without a React re-render.
  const setNativeText = useCallback((nextValue: string) => {
    inputRef.current?.setNativeProps({ text: nextValue });
  }, []);

  const handle = useMemo<AuthTextFieldHandle>(
    () => ({
      focus: () => inputRef.current?.focus(),
      getValue: () => valueRef.current,
      setValue: (nextValue) => {
        const normalizedValue = normalize?.(nextValue) ?? nextValue;
        valueRef.current = normalizedValue;
        setNativeText(normalizedValue);
      },
      validate: () => validate(),
      hasError: () => errorTextRef.current.length > 0,
    }),
    [normalize, setNativeText, validate],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  const handleChangeText = useCallback(
    (nextRawValue: string) => {
      const nextValue = normalize?.(nextRawValue) ?? nextRawValue;
      valueRef.current = nextValue;

      // Only reach back into the native field when normalization actually
      // changed the text (e.g. stripping non-digits from an OTP). Typing the
      // common case leaves the native buffer untouched -> no flicker.
      if (nextValue !== nextRawValue) {
        setNativeText(nextValue);
      }

      if (errorTextRef.current) {
        const nextError = validateValue?.(nextValue) ?? "";
        errorTextRef.current = nextError;
        setErrorText((current) => (current === nextError ? current : nextError));
      }

      onValueChange?.(nextValue, handle);
    },
    [handle, normalize, onValueChange, setNativeText, validateValue],
  );

  return (
    <TextInput
      {...props}
      ref={inputRef}
      defaultValue={initialValue}
      onChangeText={handleChangeText}
      onBlur={(event) => {
        validate();
        onBlur?.(event);
      }}
      error={!!errorText}
      errorText={errorText}
    />
  );
}

export const AuthTextField = memo(AuthTextFieldComponent);
