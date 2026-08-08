# Sign-in form block

Credential card: label + input pairs, a submit button, a separator, and one
outline button per social provider.

## Files

- `Block.tsx` — the reusable, props-driven component (`SignInFormBlock`). Copy this into your app.
- `meta.ts` — registry metadata (label, category, recipe) that drives the blocks gallery.

## Use it

```tsx
import { SignInFormBlock } from "@/client/blocks/sign-in-form/Block";

<SignInFormBlock
  title="Welcome back"
  onSubmit={({ email, password }) => signIn(email, password)}
  onSocialPress={(providerId) => startOAuth(providerId)}
/>
```

Pass `socialProviders={[]}` to hide the separator and social group.

Deliberately presentational: it owns only the two field values and hands them to `onSubmit`. For a production sign-in with validation, i18n, error states, and keyboard handling, use `client/features/auth/components/SignInForm` — this block is the layout you copy when you need the shape without the auth feature.
