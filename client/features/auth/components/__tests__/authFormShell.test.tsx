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
import { KeyboardAvoidingView as RNKeyboardAvoidingView, Platform, Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";
import { KeyboardAvoidingView } from "@mrmeg/expo-ui/components/KeyboardAvoidingView";
import { dismissKeyboard } from "@mrmeg/expo-ui/components/keyboardDismiss";

import { AuthFormCard } from "../AuthFormCard";
import {
  getSocialLabel,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
} from "../validators";
import { VerifyEmailForm } from "../VerifyEmailForm";
import { SignInForm } from "../SignInForm";
import { SignUpForm } from "../SignUpForm";
import { ForgotPasswordForm } from "../ForgotPasswordForm";
import { ResetPasswordForm } from "../ResetPasswordForm";

/** Matches the global react-i18next mock in test/setup.ts: keys pass through. */
const t = (key: string) => key;

type RenderedTree = ReactTestRendererJSON | ReactTestRendererJSON[] | null;

/**
 * RNTL 14 dropped the `UNSAFE_*ByType` queries, so the shell's wrapper is
 * checked against the host tree instead: a `ScrollView` shows up as
 * `RCTScrollView`. The keyboard-controller mock forwards avoidance props to a View.
 */
function hostNodes(node: RenderedTree): ReactTestRendererJSON[] {
  if (node == null || typeof node !== "object") return [];
  const nodes: ReactTestRendererJSON[] = Array.isArray(node) ? node : [node];
  return nodes.flatMap((child) => typeof child !== "object" || child == null ? [] : [
    child,
    ...hostNodes(child.children as RenderedTree),
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

  it.each([
    ["ios", false],
    ["ios", true],
    ["android", false],
    ["android", true],
  ] as const)("owns tap dismissal with one scroll view and avoider (%s, parent avoidance: %s)", async (platform, parentAvoidance) => {
    jest.replaceProperty(Platform, "OS", platform);
    const rnAvoider = jest.spyOn(RNKeyboardAvoidingView.prototype, "render");
    const form = (
      <AuthFormCard title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>
    );
    const view = await render(
      parentAvoidance ? <KeyboardAvoidingView>{form}</KeyboardAvoidingView> : form,
    );
    const nodes = hostNodes(view.toJSON());
    const scrolls = nodes.filter((node) => node.type === "RCTScrollView");
    const boundaries = nodes.filter((node) => node.props.onTouchEnd && node.props.onStartShouldSetResponder);

    expect(scrolls).toHaveLength(1);
    // RN's handled policy can blur a hosted input after a non-scrolling drag.
    expect(scrolls[0].props.keyboardShouldPersistTaps).toBe("always");
    expect(scrolls[0].props.keyboardDismissMode).toBe(platform === "ios" ? "interactive" : "none");
    expect(scrolls[0].props.onScrollBeginDrag).toBe(platform === "android" ? dismissKeyboard : undefined);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].props.onTouchStart).toEqual(expect.any(Function));
    expect(boundaries[0].props.onTouchMove).toEqual(expect.any(Function));
    expect(nodes.filter((node) => node.props.automaticOffset === true)).toHaveLength(1);
    expect(rnAvoider).not.toHaveBeenCalled();
  });

  it("skips the scroll wrapper when embedded in a parent scroll view", async () => {
    const view = await render(
      <AuthFormCard embedded title="Card title">
        <Text>Body slot</Text>
      </AuthFormCard>,
    );
    const tree = view.toJSON();

    const nodes = hostNodes(tree);
    expect(nodes.map((node) => node.type)).not.toContain("RCTScrollView");
    expect(nodes.some((node) => node.props.automaticOffset || node.props.onTouchEnd)).toBe(false);
    expect(rootStyles(tree)).toContainEqual({ width: "100%" });
  });
});

describe("auth control labels", () => {
  it.each([
    {
      name: "sign in",
      form: <SignInForm embedded onSignUp={() => {}} onForgotPassword={() => {}} />,
      labels: ["auth.signUp", "auth.forgotPassword"],
      readable: "auth.noAccount",
    },
    {
      name: "sign up",
      form: <SignUpForm embedded onSignIn={() => {}} />,
      labels: ["auth.signIn"],
      readable: "auth.hasAccount",
    },
    {
      name: "verify email",
      form: <VerifyEmailForm embedded email="ada@example.com" onBack={() => {}} onChangeEmail={() => {}} />,
      labels: ["auth.backToSignIn", "auth.resendCodeLink", "auth.wrongEmail auth.changeIt"],
      readable: "auth.didntReceiveCode",
    },
    {
      name: "forgot password",
      form: <ForgotPasswordForm embedded onBack={() => {}} />,
      labels: ["auth.backToSignIn"],
      readable: "auth.forgotPasswordDescription",
    },
    {
      name: "reset password",
      form: <ResetPasswordForm embedded onBack={() => {}} />,
      labels: ["auth.backToSignIn"],
      readable: "auth.passwordMinLength",
    },
  ])("keeps $name control text nonselectable and readable copy selectable", async ({ form, labels, readable }) => {
    await render(form);

    for (const label of labels) {
      expect(screen.getByText(label).props.selectable).toBe(false);
      expect(screen.getByRole("button", { name: label }).props.focusable).not.toBe(false);
    }
    expect(screen.getByText(readable).props.selectable).toBe(true);
    if (screen.queryByText("auth.changeIt")) {
      expect(screen.getByText("auth.changeIt").props.selectable).toBe(false);
    }
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
