/**
 * SignUpForm credential-method coverage.
 *
 * The form has two layouts over the same email field: passwordless (the default
 * when the caller passes `onPasswordlessSignUp`) and password. Everything about
 * the split is optional-prop driven, because the showcase renders the form
 * without the new handler and must keep the password layout — that back-compat
 * is what these tests pin down.
 *
 * `AuthScreen.test.tsx` covers the flow the passwordless action feeds into
 * (confirmation code, then email-code sign-in); this file stays at the form's
 * own contract.
 */

import "@/test/mockTheme";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SignUpForm } from "../SignUpForm";

const NAME = "Ada";
const EMAIL = "ada@example.com";
const PASSWORD = "password1";

describe("SignUpForm", () => {
  it("leads with the email-only layout when the caller supports passwordless sign-up", async () => {
    const onPasswordlessSignUp = jest.fn();

    await render(
      <SignUpForm embedded requireName={false} onPasswordlessSignUp={onPasswordlessSignUp} />,
    );

    expect(screen.getByTestId("sign-up-passwordless-button")).toBeTruthy();
    expect(screen.getByText("auth.signUpWithoutPasswordDescription")).toBeTruthy();
    // No password rules to satisfy, so nothing password-shaped is on screen.
    expect(screen.queryByTestId("sign-up-password-input")).toBeNull();
    expect(screen.queryByTestId("sign-up-confirm-password-input")).toBeNull();
    expect(screen.queryByTestId("sign-up-submit-button")).toBeNull();
  });

  it("submits the email to the passwordless handler", async () => {
    const onPasswordlessSignUp = jest.fn();

    await render(
      <SignUpForm embedded requireName={false} onPasswordlessSignUp={onPasswordlessSignUp} />,
    );
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("sign-up-passwordless-button"));

    expect(onPasswordlessSignUp).toHaveBeenCalledWith({ name: "", email: EMAIL });
  });

  it("validates the email before creating a passwordless account", async () => {
    const onPasswordlessSignUp = jest.fn();

    await render(
      <SignUpForm embedded requireName={false} onPasswordlessSignUp={onPasswordlessSignUp} />,
    );
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), "not-an-email");
    await fireEvent.press(screen.getByTestId("sign-up-passwordless-button"));

    expect(onPasswordlessSignUp).not.toHaveBeenCalled();
    expect(screen.getByText("errors.invalidEmail")).toBeTruthy();
  });

  it("still collects the name when the caller requires one", async () => {
    const onPasswordlessSignUp = jest.fn();

    await render(<SignUpForm embedded onPasswordlessSignUp={onPasswordlessSignUp} />);
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("sign-up-passwordless-button"));

    expect(onPasswordlessSignUp).not.toHaveBeenCalled();
    expect(screen.getByText("errors.nameRequired")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("sign-up-name-input"), NAME);
    await fireEvent.press(screen.getByTestId("sign-up-passwordless-button"));

    expect(onPasswordlessSignUp).toHaveBeenCalledWith({ name: NAME, email: EMAIL });
  });

  it("toggles to the password layout and back", async () => {
    const onSignUp = jest.fn();
    const onPasswordlessSignUp = jest.fn();

    await render(
      <SignUpForm
        embedded
        requireName={false}
        onPasswordlessSignUp={onPasswordlessSignUp}
        onSignUp={onSignUp}
      />,
    );

    await fireEvent.press(screen.getByTestId("sign-up-add-password-button"));

    expect(screen.getByTestId("sign-up-password-input")).toBeTruthy();
    expect(screen.getByTestId("sign-up-confirm-password-input")).toBeTruthy();
    expect(screen.queryByTestId("sign-up-passwordless-button")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-up-password-input"), PASSWORD);
    await fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-up-submit-button"));

    expect(onSignUp).toHaveBeenCalledWith({ name: "", email: EMAIL, password: PASSWORD });
    expect(onPasswordlessSignUp).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("sign-up-use-passwordless-button"));

    expect(screen.getByTestId("sign-up-passwordless-button")).toBeTruthy();
    expect(screen.queryByTestId("sign-up-password-input")).toBeNull();
  });

  it("keeps the password rules on the toggled-in layout", async () => {
    const onSignUp = jest.fn();

    await render(
      <SignUpForm embedded requireName={false} onPasswordlessSignUp={() => {}} onSignUp={onSignUp} />,
    );
    await fireEvent.press(screen.getByTestId("sign-up-add-password-button"));
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-up-password-input"), "short");
    await fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), "different");
    await fireEvent.press(screen.getByTestId("sign-up-submit-button"));

    expect(onSignUp).not.toHaveBeenCalled();
    expect(screen.getByText("errors.passwordMinLength")).toBeTruthy();
    expect(screen.getByText("errors.passwordMismatch")).toBeTruthy();
  });

  it("stays password-only for callers that never pass a passwordless handler", async () => {
    const onSignUp = jest.fn();

    await render(<SignUpForm embedded onSignUp={onSignUp} />);

    expect(screen.getByTestId("sign-up-name-input")).toBeTruthy();
    expect(screen.getByTestId("sign-up-password-input")).toBeTruthy();
    expect(screen.getByTestId("sign-up-confirm-password-input")).toBeTruthy();
    expect(screen.getByTestId("sign-up-submit-button")).toBeTruthy();
    expect(screen.getByText("auth.signUpDescription")).toBeTruthy();
    // Nothing to toggle to, so the toggle itself is absent.
    expect(screen.queryByTestId("sign-up-add-password-button")).toBeNull();
    expect(screen.queryByTestId("sign-up-use-passwordless-button")).toBeNull();
    expect(screen.queryByTestId("sign-up-passwordless-button")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("sign-up-name-input"), NAME);
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-up-password-input"), PASSWORD);
    await fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-up-submit-button"));

    expect(onSignUp).toHaveBeenCalledWith({ name: NAME, email: EMAIL, password: PASSWORD });
  });

  it("lets the caller override the description", async () => {
    await render(
      <SignUpForm embedded description="Finishing up..." onPasswordlessSignUp={() => {}} />,
    );

    expect(screen.getByText("Finishing up...")).toBeTruthy();
    expect(screen.queryByText("auth.signUpWithoutPasswordDescription")).toBeNull();
  });
});
