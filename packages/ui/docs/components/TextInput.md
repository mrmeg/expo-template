---
components: [TextInput]
use-for: "Text entry with label, helper/error text, clear, password reveal"
instead-of: "Raw `TextInput` plus repeated label/error code"
---

# TextInput

Owns label, helper/error text, clear button, password reveal, numeric filtering, left/right elements.

- `TextInput` on iOS/Android hides its visible label and `helperText` from assistive tech (the native field's name and hint carry them), keeps `errorText` as its own element and announces it when it appears or changes, and speaks `required` as `requiredHint` in the hint: pass a translated `requiredHint` (default `"required"`) on required fields. Native tests that `getByText` a hidden `helperText` or label need `{ includeHiddenElements: true }`; `errorText` queries are unchanged. Web uses `aria-label`, `aria-describedby` and `aria-required`.
- `TextInput` `onBlur` fires only after a real focus on Android (the native field's first-composition blur is dropped in the package); validate on blur directly and do not add a touched-fields guard in app code.

## Minimal Examples

```tsx
import { Button, Switch, TextInput } from "@mrmeg/expo-ui/components";

<TextInput
  label="Email"
  placeholder="you@example.com"
  autoCapitalize="none"
  keyboardType="email-address"
  errorText={emailError}
/>

<Switch checked={enabled} onCheckedChange={setEnabled} variant="ios" />

<Button preset="default" size="lg" fullWidth loading={isSubmitting}>
  Continue
</Button>
```
