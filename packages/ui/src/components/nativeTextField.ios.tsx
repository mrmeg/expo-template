/**
 * Native text field indirection — iOS variant.
 *
 * Wraps `@expo/ui`'s universal `TextInput` (SwiftUI `TextField`/`SecureField`,
 * which already reports a password field to the keyboard) and differs in
 * exactly one place:
 *
 * 1. **The field is named and described for VoiceOver.** The universal field
 *    has no accessibility props, so `accessibilityLabel` and `accessibilityHint`
 *    become SwiftUI `accessibilityLabel` / `accessibilityHint` modifiers. The
 *    universal iOS field prepends the caller's `modifiers` to its own, so these
 *    reach the `TextField` / `SecureField` itself, after any modifier the caller
 *    passed.
 *
 * `NativeTextFieldProps` is the default file's type; all variants must export
 * the same names with the same types. Only `@expo/ui/swift-ui/modifiers` is
 * imported beyond the universal field, and its module calls
 * `requireNativeModule('ExpoUI')` at load: this file must therefore only ever be
 * resolved on iOS (Metro's `.ios` suffix, Jest's default platform), never by web.
 */
import {
  accessibilityHint as accessibilityHintModifier,
  accessibilityLabel as accessibilityLabelModifier,
} from "@expo/ui/swift-ui/modifiers";
import { TextInput } from "@expo/ui";
// Type-only: a value import of "./nativeTextField" here would resolve back to
// this file under Metro's `.ios` suffix.
import type { NativeTextFieldProps } from "./nativeTextField";

export type { NativeTextFieldProps };

export function NativeTextField({
  accessibilityLabel,
  accessibilityHint,
  modifiers,
  ...props
}: NativeTextFieldProps) {
  return (
    <TextInput
      {...props}
      modifiers={[
        ...(modifiers ?? []),
        ...(accessibilityLabel ? [accessibilityLabelModifier(accessibilityLabel)] : []),
        ...(accessibilityHint ? [accessibilityHintModifier(accessibilityHint)] : []),
      ]}
    />
  );
}
