/**
 * Native text field indirection — default variant (web, and the type surface
 * TypeScript resolves).
 *
 * Metro resolves `nativeTextField.ios.tsx` on iOS and
 * `nativeTextField.android.tsx` on Android, and Jest, like Metro on iOS,
 * resolves the `.ios` file for a bare `./nativeTextField` import; this file is
 * the type surface all three share and the fallback for every other target.
 * `TextInput.tsx` renders the native field only on iOS and Android, so on web
 * this is never mounted — it just keeps the import graph and the types whole.
 *
 * `@expo/ui`'s universal `TextInput` has no accessibility props: each platform
 * file turns `accessibilityLabel` / `accessibilityHint` into the platform's own
 * modifier (SwiftUI `accessibilityLabel`/`accessibilityHint`, Compose
 * `semantics { contentDescription }`). This variant has no such modifier, so it
 * drops the two props and renders the universal field with the rest. All
 * variants must export the same names with the same types — consumers and the
 * type checker only ever see this file.
 */
import { TextInput, type TextInputProps } from "@expo/ui";

export type NativeTextFieldProps = TextInputProps & {
  /** Spoken name of the field; `TextInput` passes its `label` here. */
  accessibilityLabel?: string;
  /** Spoken description of the field; `TextInput` passes its error or helper text here. */
  accessibilityHint?: string;
};

export function NativeTextField({
  // Dropped on purpose: the universal field has no accessibility props.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accessibilityLabel, accessibilityHint,
  ...props
}: NativeTextFieldProps) {
  return <TextInput {...props} />;
}
