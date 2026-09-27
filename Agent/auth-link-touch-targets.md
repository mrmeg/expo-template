---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/135
---

# Auth text links get a 44 pt target

## Goal
The nine tappable text links in the auth forms ("Sign up", "Sign in", "Forgot password?", "Email me a code" / "Use password instead", "Back to sign in", "Resend", "Change email", "Sign up without a password") are 21–29 px tall on web and native. Give them a shared `AuthLink` with a 44 pt minimum target and keep the visible text where it is.

## Context
- Measured on `/auth-demo` at 390×844 (origin/dev `c4bccf1`): `Sign up` 51×21, `Use password instead` 142×29, `Email me a code` 356×32 (`/tmp/fleet/ui/expo-ui/w5-before/auth-demo-*.png`, `probes.md`).
- Sites: `client/features/auth/components/SignInForm.tsx` (lines ~112, ~163, ~200), `SignUpForm.tsx` (~148, ~274), `ForgotPasswordForm.tsx` (~98), `ResetPasswordForm.tsx` (~106), `VerifyEmailForm.tsx` (~110, ~159, ~168). Each is a bare `Pressable accessibilityRole="button"` wrapping `SansSerifText`/`SansSerifBoldText size="base"` with `shared.linkText` from `authFormStyles.ts`. The footer ones sit inline after a muted sentence inside `CardFooter` (`AuthFormCard.tsx` line 83).
- Tokens: `spacing.touchTarget` (44) is the native minimum, `spacing.minTarget` (24) the web minimum; use 44 on both so the row reads the same everywhere.
- Existing tests query these by role/name (`authFormShell.test.tsx` `labels: ["auth.signUp", "auth.forgotPassword"]`, `SignUpForm.test.tsx` `getByRole("button", { name: "auth.signUpWithoutPasswordInstead" })`, `AuthScreen.test.tsx` `getByText("auth.signUp")`); they must keep passing.

## Work
1. `client/features/auth/components/AuthLink.tsx`: `Pressable` with `accessibilityRole="button"`, props `onPress`, `disabled`, `testID`, `style`, `children`; style `minHeight: spacing.touchTarget`, `justifyContent: "center"`, `paddingHorizontal: spacing.xs`, and on web `cursor: "pointer"`; pressed state via `opacity`. Export it from the auth components barrel only if the barrel lists siblings (check `client/features/auth/components/index.ts`).
2. Replace the nine `Pressable`s with `AuthLink`, keeping the existing text children and `shared.linkText`. Where a link sits inline after muted copy, set the footer/row to `alignItems: "center"` so the 44 pt link centres on the sentence; `VerifyEmailForm`'s `styles.changeEmail` stays as the `style` prop.
3. Add `AuthLink` to `Agent/`-free docs only if `docs/template-modernization-guide.md` lists auth form parts (grep `SignInForm`); otherwise no doc change.

## Validation
- RED first: `client/features/auth/components/__tests__/AuthLink.test.tsx` — flattened style has `minHeight >= spacing.touchTarget`, role `button`, `disabled` reaches the Pressable, `onPress` fires; and in `authFormShell.test.tsx` every link button in the five forms has that min height.
- `bun run test:ci -- --maxWorkers=2 client/features/auth`, `bun run typecheck`, `bun run lint`, `bun lint:ui --changed` (through heavy-slot).
- Web after-pass (Metro 8133, `/tmp/fleet/ui/expo-ui/auth-targets.mjs` with out dir `/tmp/fleet/ui/expo-ui/auth-links/after`): every listed link ≥ 44 px tall; screenshots light + dark.

## Out of scope
The primary/secondary `Button`s in the forms; auth copy; the kit's `Button` link variant.

## Open questions
None.
