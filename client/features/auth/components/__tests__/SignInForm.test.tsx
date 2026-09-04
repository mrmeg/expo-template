/**
 * SignInForm credential-method coverage.
 *
 * The form has two layouts over the same email field: email-code (the default
 * when the caller passes `onEmailCodeSignIn`) and password. Everything about
 * the split is optional-prop driven, because the showcase and
 * `client/blocks/sign-in-form/Block.tsx` render the form without the new
 * handler and must keep the password layout — that back-compat is what these
 * tests pin down, along with the social buttons the screen now feeds from env.
 *
 * `AuthScreen.test.tsx` covers the flow the toggle feeds into; this file stays
 * at the form's own contract.
 */

import "@/test/mockTheme";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SignInForm } from "../SignInForm";

const EMAIL = "ada@example.com";
const PASSWORD = "password1";

describe("SignInForm", () => {
  it("leads with the email-code layout when the caller supports it", async () => {
    const onEmailCodeSignIn = jest.fn();

    await render(<SignInForm embedded onEmailCodeSignIn={onEmailCodeSignIn} />);

    expect(screen.getByTestId("sign-in-email-code-button")).toBeTruthy();
    expect(screen.getByText("auth.signInWithCodeDescription")).toBeTruthy();
    // No password rules to satisfy, so nothing password-shaped is on screen.
    expect(screen.queryByTestId("sign-in-password-input")).toBeNull();
    expect(screen.queryByTestId("sign-in-submit-button")).toBeNull();
    expect(screen.queryByText("auth.forgotPassword")).toBeNull();
  });

  it("submits the email to the code handler", async () => {
    const onEmailCodeSignIn = jest.fn();

    await render(<SignInForm embedded onEmailCodeSignIn={onEmailCodeSignIn} />);
    await fireEvent.changeText(screen.getByTestId("sign-in-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("sign-in-email-code-button"));

    expect(onEmailCodeSignIn).toHaveBeenCalledWith({ email: EMAIL });
  });

  it("validates the email before requesting a code", async () => {
    const onEmailCodeSignIn = jest.fn();

    await render(<SignInForm embedded onEmailCodeSignIn={onEmailCodeSignIn} />);
    await fireEvent.changeText(screen.getByTestId("sign-in-email-input"), "not-an-email");
    await fireEvent.press(screen.getByTestId("sign-in-email-code-button"));

    expect(onEmailCodeSignIn).not.toHaveBeenCalled();
    expect(screen.getByText("errors.invalidEmail")).toBeTruthy();
  });

  it("toggles to the password layout and back", async () => {
    const onSignIn = jest.fn();
    const onEmailCodeSignIn = jest.fn();

    await render(
      <SignInForm
        embedded
        onEmailCodeSignIn={onEmailCodeSignIn}
        onForgotPassword={() => {}}
        onSignIn={onSignIn}
      />,
    );

    await fireEvent.press(screen.getByTestId("sign-in-use-password-button"));

    expect(screen.getByTestId("sign-in-password-input")).toBeTruthy();
    expect(screen.getByText("auth.forgotPassword")).toBeTruthy();
    expect(screen.queryByTestId("sign-in-email-code-button")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("sign-in-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-in-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-in-submit-button"));

    expect(onSignIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(onEmailCodeSignIn).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("sign-in-use-code-button"));

    expect(screen.getByTestId("sign-in-email-code-button")).toBeTruthy();
    expect(screen.queryByTestId("sign-in-password-input")).toBeNull();
  });

  it("stays password-only for callers that never pass a code handler", async () => {
    const onSignIn = jest.fn();

    await render(<SignInForm embedded onForgotPassword={() => {}} onSignIn={onSignIn} />);

    expect(screen.getByTestId("sign-in-password-input")).toBeTruthy();
    expect(screen.getByTestId("sign-in-submit-button")).toBeTruthy();
    expect(screen.getByText("auth.signInDescription")).toBeTruthy();
    // Nothing to toggle to, so the toggle itself is absent.
    expect(screen.queryByTestId("sign-in-use-code-button")).toBeNull();
    expect(screen.queryByTestId("sign-in-use-password-button")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("sign-in-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-in-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-in-submit-button"));

    expect(onSignIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
  });

  it("renders one social button per provided provider", async () => {
    const onSocialSignIn = jest.fn();

    await render(
      <SignInForm embedded onSocialSignIn={onSocialSignIn} socialProviders={["google", "apple"]} />,
    );

    expect(screen.getByText("auth.continueWithGoogle")).toBeTruthy();
    expect(screen.getByText("auth.continueWithApple")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("sign-in-social-apple-button"));

    expect(onSocialSignIn).toHaveBeenCalledWith("apple");
  });

  it("hides the social section for an empty provider list", async () => {
    await render(<SignInForm embedded socialProviders={[]} />);

    expect(screen.queryByText("auth.or")).toBeNull();
    expect(screen.queryByTestId("sign-in-social-google-button")).toBeNull();
  });

  it("lets the caller override the description", async () => {
    await render(
      <SignInForm embedded description="Finishing up..." onEmailCodeSignIn={() => {}} />,
    );

    expect(screen.getByText("Finishing up...")).toBeTruthy();
    expect(screen.queryByText("auth.signInWithCodeDescription")).toBeNull();
  });
});
