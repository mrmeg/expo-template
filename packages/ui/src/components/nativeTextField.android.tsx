/**
 * Native text field indirection — Android variant.
 *
 * A package-owned port of `@expo/ui`'s universal Android `TextInput`
 * (`@expo/ui` 58.0.2, `src/universal/TextInput/index.android.tsx`, MIT
 * licensed, Copyright (c) 650 Industries, Inc.), built on the public
 * `@expo/ui/jetpack-compose` `BasicTextField`. It keeps the universal field's
 * prop surface (`NativeTextFieldProps` *is* `@expo/ui`'s `TextInputProps`), its
 * `useNativeState` fallback buffer, its ref handle, its slot layout and its
 * modifier order, and differs in exactly two places:
 *
 * 1. **Secure fields declare a password keyboard.** The universal field maps
 *    `secureTextEntry` to `visualTransformation="password"` only, so the IME
 *    still sees a plain text field: Gboard shows its suggestion strip, learns
 *    the password, and `dumpsys input_method` reports `TYPE_CLASS_TEXT` with no
 *    password variation. Here a secure field sets `keyboardType` to
 *    `'password'` (`textPassword`), or `'numberPassword'` when the requested
 *    keyboard is numeric, and defaults `autoCorrectEnabled` to `false` and
 *    `capitalization` to `'none'`. Once a mounted field has been secure the
 *    password keyboard options stay constant for its lifetime, so the eye
 *    toggle (`secureTextEntry` true -> false on the same element) only drops the
 *    masking transformation: Compose treats `KeyboardType.Password` with
 *    `VisualTransformation.None` as the canonical revealed-password state, and
 *    an unchanged `KeyboardOptions` avoids an IME restart, preserving focus,
 *    selection and the input connection.
 * 2. **Box style maps only the padding keys the package sends.** The universal
 *    field's `transformToModifiers` is not a public export. `TextInput.tsx`
 *    hands the field `{ backgroundColor: "transparent", paddingHorizontal,
 *    paddingVertical }` and paints the surface (fill, border, radius) on its RN
 *    wrapper, so `styleToModifiers` below handles the padding cascade and
 *    ignores `backgroundColor`.
 *
 * Only `@expo/ui/jetpack-compose` and `@expo/ui/jetpack-compose/modifiers` are
 * imported, both in the peer's export map since SDK 56.
 */
import { useImperativeHandle, useRef, useState } from "react";
import type { KeyboardTypeOptions, ReturnKeyTypeOptions } from "react-native";
import type { TextInputProps } from "@expo/ui";
import {
  BasicTextField,
  Box,
  Text,
  useNativeState,
  type TextFieldImeAction,
  type TextFieldKeyboardOptions,
  type TextFieldKeyboardType,
  type TextFieldRef,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  onSizeChanged,
  padding,
  paddingAll,
  semantics,
  testID as testIDModifier,
  type ModifierConfig,
} from "@expo/ui/jetpack-compose/modifiers";

export type NativeTextFieldProps = TextInputProps;

type InputMode = NonNullable<TextInputProps["inputMode"]>;
type EnterKeyHint = NonNullable<TextInputProps["enterKeyHint"]>;
type BoxStyle = NonNullable<TextInputProps["style"]>;

// region Prop mapping (ported verbatim from @expo/ui's TextInput/utils.ts)

function inputModeToKeyboardType(inputMode: InputMode | undefined): KeyboardTypeOptions | undefined {
  if (!inputMode || inputMode === "none") return undefined;
  switch (inputMode) {
    case "text":
      return "default";
    case "decimal":
      return "decimal-pad";
    case "tel":
      return "phone-pad";
    case "search":
      return "web-search";
    case "email":
      return "email-address";
    default:
      return inputMode as KeyboardTypeOptions;
  }
}

function enterKeyHintToReturnKeyType(hint: EnterKeyHint | undefined): ReturnKeyTypeOptions | undefined {
  if (!hint) return undefined;
  if (hint === "enter") return "default";
  return hint as ReturnKeyTypeOptions;
}

function resolveEditable(editable: boolean | undefined, readOnly: boolean | undefined): boolean | undefined {
  if (editable !== undefined) return editable;
  if (readOnly === true) return false;
  return undefined;
}

function mapReturnKeyType(value: ReturnKeyTypeOptions): TextFieldImeAction {
  if (value === "google" || value === "yahoo") return "search";
  if (value === "join" || value === "route" || value === "emergency-call") return "default";
  return value as TextFieldImeAction;
}

function mapKeyboardType(value: KeyboardTypeOptions): TextFieldKeyboardType {
  switch (value) {
    case "default":
      return "text";
    case "email-address":
      return "email";
    case "numeric":
      return "decimal";
    case "number-pad":
      return "number";
    case "decimal-pad":
      return "decimal";
    case "phone-pad":
      return "phone";
    case "url":
      return "uri";
    case "ascii-capable":
    case "numbers-and-punctuation":
    case "name-phone-pad":
    case "twitter":
    case "web-search":
    case "visible-password":
      return "text";
    default:
      return "text";
  }
}

// endregion Prop mapping

// region Style mapping

/** Compose modifiers take dp numbers; anything else (percent strings, animated values) is ignored. */
function dp(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Maps the box-style padding keys to Compose padding modifiers, with the same
 * cascade as `@expo/ui`'s `transformToModifiers`: a specific side beats the
 * directional shorthand, which beats `padding`. `backgroundColor` is
 * deliberately not mapped — the RN wrapper in `TextInput.tsx` paints the
 * surface.
 */
function styleToModifiers(style: BoxStyle | undefined): ModifierConfig[] {
  if (!style) return [];
  const all = dp(style.padding) ?? 0;
  const top = dp(style.paddingTop) ?? dp(style.paddingVertical) ?? all;
  const bottom = dp(style.paddingBottom) ?? dp(style.paddingVertical) ?? all;
  const start = dp(style.paddingLeft) ?? dp(style.paddingHorizontal) ?? all;
  const end = dp(style.paddingRight) ?? dp(style.paddingHorizontal) ?? all;
  if (!top && !bottom && !start && !end) return [];
  if (top === bottom && bottom === start && start === end) return [paddingAll(top)];
  return [padding(start, top, end, bottom)];
}

// endregion Style mapping

/**
 * Picks the password keyboard for a secure field: numeric keyboards become
 * `numberPassword` (a `TYPE_CLASS_NUMBER | TYPE_NUMBER_VARIATION_PASSWORD`
 * field), everything else `password` (`TYPE_TEXT_VARIATION_PASSWORD`).
 */
function passwordKeyboardType(mapped: TextFieldKeyboardType | undefined): TextFieldKeyboardType {
  return mapped === "number" || mapped === "decimal" || mapped === "phone" ? "numberPassword" : "password";
}

export function NativeTextField({
  ref,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  editable: editableProp,
  multiline,
  keyboardType: keyboardTypeProp,
  autoCapitalize,
  autoCorrect,
  returnKeyType: returnKeyTypeProp,
  onSubmitEditing,
  onFocus,
  onBlur,
  cursorColor,
  textAlign,
  readOnly,
  inputMode,
  enterKeyHint,
  defaultValue,
  numberOfLines: numberOfLinesProp,
  rows,
  testID,
  placeholderTextColor,
  textStyle,
  style,
  secureTextEntry,
  autoComplete,
  onContentSizeChange,
  maxLength,
  caretHidden,
  selectionColor,
  selectionHandleColor,
  selection,
  onSelectionChange,
  selectTextOnFocus,
  modifiers: userModifiers,
}: NativeTextFieldProps) {
  const editable = resolveEditable(editableProp, readOnly);
  const numberOfLines = numberOfLinesProp ?? rows;
  const keyboardType = keyboardTypeProp ?? inputModeToKeyboardType(inputMode);
  const returnKeyType = returnKeyTypeProp ?? enterKeyHintToReturnKeyType(enterKeyHint);

  // Pinned to the first render's `defaultValue`, as an uncontrolled default
  // is, whatever `useNativeState` does with a later argument.
  const [initialFallback] = useState(defaultValue ?? "");
  const fallback = useNativeState<string>(initialFallback);
  const state = (value ?? fallback) as typeof fallback;

  const innerRef = useRef<TextFieldRef>(null);
  const isFocusedRef = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        innerRef.current?.focus();
      },
      blur: () => {
        innerRef.current?.blur();
      },
      clear: () => {
        innerRef.current?.clear();
      },
      isFocused: () => isFocusedRef.current,
      setSelection: (start: number, end: number) =>
        innerRef.current?.setSelection(start, end) ?? Promise.resolve(),
    }),
    []
  );

  const handleFocusChanged = (focused: boolean) => {
    isFocusedRef.current = focused;
    if (focused && selectTextOnFocus) {
      innerRef.current?.setSelection(0, state.value.length);
    }
    if (focused) onFocus?.();
    else onBlur?.();
  };

  // Sticky for the life of the mounted field: revealing a password
  // (`secureTextEntry` -> false on the same element) must keep the password
  // keyboard options unchanged so the IME neither restarts nor starts
  // suggesting/learning the now-visible text. The latch is state adjusted
  // during render (React re-runs this render before committing it), and the
  // `||` makes the very render that turns secure on already read as a password
  // field; a fresh mount starts from the prop.
  const [everSecure, setEverSecure] = useState(!!secureTextEntry);
  if (secureTextEntry && !everSecure) setEverSecure(true);
  const passwordField = everSecure || !!secureTextEntry;

  const mappedKeyboardType = keyboardType ? mapKeyboardType(keyboardType) : undefined;
  const resolvedKeyboardType = passwordField
    ? passwordKeyboardType(mappedKeyboardType)
    : mappedKeyboardType;
  const capitalization = autoCapitalize ?? (passwordField ? "none" : undefined);
  const autoCorrectEnabled = autoCorrect ?? (passwordField ? false : undefined);

  const keyboardOptions: TextFieldKeyboardOptions | undefined =
    resolvedKeyboardType || capitalization || autoCorrectEnabled !== undefined || returnKeyType
      ? {
        ...(resolvedKeyboardType ? { keyboardType: resolvedKeyboardType } : null),
        ...(capitalization ? { capitalization } : null),
        ...(autoCorrectEnabled !== undefined ? { autoCorrectEnabled } : null),
        ...(returnKeyType ? { imeAction: mapReturnKeyType(returnKeyType) } : null),
      }
      : undefined;

  const keyboardActions = onSubmitEditing
    ? {
      onDone: onSubmitEditing,
      onGo: onSubmitEditing,
      onNext: onSubmitEditing,
      onSearch: onSubmitEditing,
      onSend: onSubmitEditing,
      onPrevious: onSubmitEditing,
    }
    : undefined;

  return (
    <BasicTextField
      ref={innerRef}
      modifiers={[
        ...(userModifiers ?? []),
        ...styleToModifiers(style),
        ...(testID ? [testIDModifier(testID)] : []),
        ...(autoComplete ? [semantics({ contentType: autoComplete })] : []),
        ...(onContentSizeChange ? [onSizeChanged(onContentSizeChange)] : []),
      ]}
      value={state}
      autoFocus={autoFocus}
      readOnly={editable === false}
      singleLine={!multiline}
      maxLines={multiline && numberOfLines && numberOfLines > 0 ? numberOfLines : undefined}
      minLines={multiline && numberOfLines && numberOfLines > 0 ? numberOfLines : undefined}
      cursorColor={caretHidden ? "transparent" : (cursorColor ?? selectionColor)}
      textStyle={
        textStyle || (textAlign && textAlign !== "auto")
          ? {
            ...textStyle,
            ...(textAlign && textAlign !== "auto" ? { textAlign } : null),
          }
          : undefined
      }
      visualTransformation={secureTextEntry ? "password" : undefined}
      textSelectionColors={
        selectionColor || selectionHandleColor
          ? {
            handleColor: selectionHandleColor ?? selectionColor,
            backgroundColor: selectionColor,
          }
          : undefined
      }
      keyboardOptions={keyboardOptions}
      keyboardActions={keyboardActions}
      onValueChange={onChangeText}
      maxLength={maxLength}
      onFocusChanged={handleFocusChanged}
      selection={selection as Parameters<typeof BasicTextField>[0]["selection"]}
      onSelectionChange={onSelectionChange}
    >
      <BasicTextField.DecorationBox>
        <Box
          modifiers={[fillMaxWidth()]}
          contentAlignment={
            textAlign === "center" ? "topCenter" : textAlign === "right" ? "topEnd" : undefined
          }
        >
          {placeholder != null ? (
            <BasicTextField.Placeholder>
              <Text
                color={placeholderTextColor as string | undefined}
                modifiers={[fillMaxWidth()]}
                style={textAlign && textAlign !== "auto" ? { textAlign } : undefined}
              >
                {placeholder}
              </Text>
            </BasicTextField.Placeholder>
          ) : null}
          <BasicTextField.InnerTextField />
        </Box>
      </BasicTextField.DecorationBox>
    </BasicTextField>
  );
}
