import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextInput as RNTextInput } from "react-native";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";

type TextInputProps = React.ComponentProps<typeof TextInput>;

export interface AuthTextFieldHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  validate: () => boolean;
  hasError: () => boolean;
}

interface AuthTextFieldProps
  extends Omit<TextInputProps, "error" | "errorText" | "onChangeText" | "value"> {
  initialValue?: string;
  normalize?: (value: string) => string;
  onValueChange?: (value: string, handle: AuthTextFieldHandle) => void;
  validateValue?: (value: string) => string;
}

function AuthTextFieldComponent(
  {
    initialValue = "",
    normalize,
    onValueChange,
    validateValue,
    onBlur,
    ...props
  }: AuthTextFieldProps,
  ref: React.ForwardedRef<AuthTextFieldHandle>,
) {
  const inputRef = useRef<RNTextInput>(null);
  const valueRef = useRef(initialValue);
  const errorTextRef = useRef("");
  const [value, setValue] = useState(initialValue);
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

  const handle = useMemo<AuthTextFieldHandle>(
    () => ({
      focus: () => inputRef.current?.focus(),
      getValue: () => valueRef.current,
      setValue: (nextValue) => {
        const normalizedValue = normalize?.(nextValue) ?? nextValue;
        valueRef.current = normalizedValue;
        setValue(normalizedValue);
      },
      validate: () => validate(),
      hasError: () => errorTextRef.current.length > 0,
    }),
    [normalize, validate],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  const handleChangeText = useCallback(
    (nextRawValue: string) => {
      const nextValue = normalize?.(nextRawValue) ?? nextRawValue;
      valueRef.current = nextValue;
      setValue(nextValue);

      if (errorTextRef.current) {
        const nextError = validateValue?.(nextValue) ?? "";
        errorTextRef.current = nextError;
        setErrorText((current) => (current === nextError ? current : nextError));
      }

      onValueChange?.(nextValue, handle);
    },
    [handle, normalize, onValueChange, validateValue],
  );

  return (
    <TextInput
      {...props}
      ref={inputRef}
      value={value}
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

export const AuthTextField = memo(forwardRef(AuthTextFieldComponent));
