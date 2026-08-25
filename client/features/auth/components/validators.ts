/**
 * Field validators shared by the auth forms.
 *
 * These were copied per form (`validateEmail` 3×, `validatePassword` 3× with
 * different minimum lengths, `validateConfirmPassword` 2×, `getSocialLabel` 2×).
 * They are plain functions rather than hooks so a form can keep wrapping them in
 * one `useCallback` — `AuthTextField` is memoized on its props, so the
 * `validateValue` identity has to stay stable across renders.
 *
 * Each returns the error message to show, or `""` when the value is valid.
 *
 * This module is part of the lazy auth-components chunk: only the components in
 * this folder may import it, and only statically. See ./index.ts.
 */

/** The `t` returned by `useTranslation`, narrowed to what validators need. */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string, t: TranslateFn): string {
  if (!value.trim()) {
    return t("errors.emailRequired");
  }
  if (!EMAIL_PATTERN.test(value)) {
    return t("errors.invalidEmail");
  }
  return "";
}

export function validatePassword(value: string, t: TranslateFn, minLength: number): string {
  if (!value) {
    return t("errors.passwordRequired");
  }
  if (value.length < minLength) {
    return t("errors.passwordMinLength", { count: minLength });
  }
  return "";
}

/**
 * `password` is read at validation time (the forms pull it off the sibling
 * field's imperative handle) so re-typing the password can re-check the
 * confirmation without rebuilding this validator.
 */
export function validateConfirmPassword(
  value: string,
  t: TranslateFn,
  password: string | undefined,
): string {
  if (!value) {
    return t("errors.confirmPasswordRequired");
  }
  if (value !== password) {
    return t("errors.passwordMismatch");
  }
  return "";
}

export function getSocialLabel(provider: string, t: TranslateFn): string {
  switch (provider) {
  case "google":
    return t("auth.continueWithGoogle");
  case "apple":
    return t("auth.continueWithApple");
  case "github":
    return t("auth.continueWithGithub");
  default:
    return t("auth.continueWith", { provider });
  }
}
