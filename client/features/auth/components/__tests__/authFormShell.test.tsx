/**
 * Unit coverage for the shared auth form scaffolding that the five forms were
 * refactored onto: the `AuthFormCard` shell, the shared validators, and the
 * i18n title fallback in `VerifyEmailForm`.
 *
 * `authRenderChurn.test.tsx` remains the behavioural guard for the forms
 * themselves (card shell must not re-render while typing); this file guards the
 * shell's own contract so a future tweak to it can't silently drop the logo,
 * the error banner, the footer, or the standalone keyboard wrapper.
 */

import "@/test/mockTheme";

import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";

import { AuthFormCard } from "../AuthFormCard";
import {
  getSocialLabel,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
} from "../validators";
import { VerifyEmailForm } from "../VerifyEmailForm";

/** Matches the global react-i18next mock in test/setup.ts: keys pass through. */
const t = (key: string) => key;

type RenderedTree = ReactTestRendererJSON | ReactTestRendererJSON[] | null;

/**
 * RNTL 14 dropped the `UNSAFE_*ByType` queries, so the shell's wrapper is
 * checked against the host tree instead: a `ScrollView` shows up as
 * `RCTScrollView`, while the `KeyboardAvoidingView` is just the root host view.
 */
function hostTypeNames(node: RenderedTree): string[] {
  if (node == null || typeof node !== "object") return [];
  const nodes: ReactTestRendererJSON[] = Array.isArray(node) ? node : [node];
  return nodes.flatMap((child) => [
    String(child.type),
    ...hostTypeNames(child.children as RenderedTree),
  ]);
}

/** Flattened style entries of the root host view (KeyboardAvoidingView adds its own). */
function rootStyles(node: RenderedTree): unknown[] {
  const root = Array.isArray(node) ? node[0] : node;
  return [root?.props?.style].flat(2);
}

describe("auth form validators", () => {
  it("requires an email and checks its shape", () => {
    expect(validateEmail("", t)).toBe("errors.emailRequired");
    expect(validateEmail("   ", t)).toBe("errors.emailRequired");
    expect(validateEmail("not-an-email", t)).toBe("errors.invalidEmail");
    expect(validateEmail("ada@example.com", t)).toBe("");
  });

  it("parameterizes the password minimum length", () => {
    expect(validatePassword("", t, 6)).toBe("errors.passwordRequired");
    expect(validatePassword("12345", t, 6)).toBe("errors.passwordMinLength");
    expect(validatePassword("123456", t, 6)).toBe("");
    expect(validatePassword("1234567", t, 8)).toBe("errors.passwordMinLength");
    expect(validatePassword("12345678", t, 8)).toBe("");
  });

  it("forwards the minimum length to the translation", () => {
    const translate = jest.fn((key: string) => key);

    validatePassword("123", translate, 8);

    expect(translate).toHaveBeenCalledWith("errors.passwordMinLength", { count: 8 });
  });

  it("compares the confirmation against the current password", () => {
    expect(validateConfirmPassword("", t, "secret")).toBe("errors.confirmPasswordRequired");
    expect(validateConfirmPassword("other", t, "secret")).toBe("errors.passwordMismatch");
    expect(validateConfirmPassword("secret", t, "secret")).toBe("");
    expect(validateConfirmPassword("secret", t, undefined)).toBe("errors.passwordMismatch");
  });

  it("labels known social providers and falls back for the rest", () => {
    expect(getSocialLabel("google", t)).toBe("auth.continueWithGoogle");
    expect(getSocialLabel("apple", t)).toBe("auth.continueWithApple");
    expect(getSocialLabel("github", t)).toBe("auth.continueWithGithub");
    expect(getSocialLabel("gitlab", t)).toBe("auth.continueWith");
  });
});

describe("AuthFormCard", () => {
  it("renders the logo, title, description, children and footer", async () => {
    await render(
      <AuthFormCard
        embedded
        description="Card description"
        footer={<Text>Footer slot</Text>}
        logo={<Text>Logo slot</Text>}
        title="Card title"
      >
        <Text>Body slot</Text>
      </AuthFormCard>,
    );

    expect(screen.getByText("Logo slot")).toBeTruthy();
    expect(screen.getByText("Card title")).toBeTruthy();
    expect(screen.getByText("Card description")).toBeTruthy();
    expect(screen.getByText("Body slot")).toBeTruthy();
    expect(screen.getByText("Footer slot")).toBeTruthy();
  });

  it("omits the optional slots when they are not provided", async () => {
    await render(
      <AuthFormCard embedded title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>,
    );

    expect(screen.getByText("Card title")).toBeTruthy();
    expect(screen.getByText("Body slot")).toBeTruthy();
    expect(screen.queryByText("Footer slot")).toBeNull();
  });

  it("shows the error banner only when there is error text", async () => {
    const view = await render(
      <AuthFormCard embedded error="" title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>,
    );

    expect(screen.queryByText("Something broke")).toBeNull();

    await view.rerender(
      <AuthFormCard embedded error="Something broke" title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>,
    );

    expect(screen.getByText("Something broke")).toBeTruthy();
  });

  it("wraps standalone forms in a keyboard-avoiding scroll view", async () => {
    const view = await render(
      <AuthFormCard title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>,
    );
    const tree = view.toJSON();

    // The KeyboardAvoidingView renders as the flex:1 root host view.
    expect(hostTypeNames(tree)).toContain("RCTScrollView");
    expect(rootStyles(tree)).toContainEqual({ flex: 1 });
  });

  it("skips the scroll wrapper when embedded in a parent scroll view", async () => {
    const view = await render(
      <AuthFormCard embedded title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>,
    );
    const tree = view.toJSON();

    expect(hostTypeNames(tree)).not.toContain("RCTScrollView");
    expect(rootStyles(tree)).toContainEqual({ width: "100%" });
  });
});

describe("VerifyEmailForm title", () => {
  it("falls back to the translated title instead of a hardcoded English string", async () => {
    await render(<VerifyEmailForm embedded email="ada@example.com" />);

    expect(screen.getByText("auth.verifyEmailTitle")).toBeTruthy();
    expect(screen.queryByText("Verify your email")).toBeNull();
  });

  it("falls back to the translated description", async () => {
    await render(<VerifyEmailForm embedded email="ada@example.com" />);

    expect(screen.getByText("auth.verifyEmailDescription")).toBeTruthy();
  });

  it("falls back to the verify copy on the submit button", async () => {
    await render(<VerifyEmailForm embedded email="ada@example.com" />);

    expect(screen.getByText("auth.verifyEmailButton")).toBeTruthy();
  });

  it("honours a caller-provided submit label", async () => {
    // The sign-in code flow reuses this form, where the code is the credential.
    await render(
      <VerifyEmailForm embedded email="ada@example.com" submitLabel="Sign in" />,
    );

    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByText("auth.verifyEmailButton")).toBeNull();
  });

  it("still honours an explicit title and description", async () => {
    await render(
      <VerifyEmailForm
        embedded
        description="Custom description"
        email="ada@example.com"
        title="Verify your email first"
      />,
    );

    expect(screen.getByText("Verify your email first")).toBeTruthy();
    expect(screen.getByText("Custom description")).toBeTruthy();
    expect(screen.queryByText("auth.verifyEmailTitle")).toBeNull();
  });
});
