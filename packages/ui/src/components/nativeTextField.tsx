/**
 * Native text field indirection — default variant (iOS; also what Jest and
 * TypeScript resolve).
 *
 * Re-exports `@expo/ui`'s universal `TextInput`, which on iOS bridges to
 * SwiftUI's `TextField`/`SecureField` and already reports a password field to
 * the keyboard when `secureTextEntry` is set.
 *
 * Metro resolves `nativeTextField.android.tsx` on Android instead: the package
 * owns the Compose field there so a secure entry can declare a password
 * keyboard type (see that file). Both variants must export the same names with
 * the same types — consumers and the type checker only ever see this one.
 */
export {
  TextInput as NativeTextField,
  type TextInputProps as NativeTextFieldProps,
} from "@expo/ui";
