/**
 * AuthScreen flow tests.
 *
 * The screen is a small state machine over five forms: which view is
 * mounted, plus the pending email/password it has to carry across a
 * view switch. Every handler updates several of those fields at once
 * (`pendingEmail` + `pendingPassword` + `postVerifyDestination` + `view`),
 * so the tests below drive the transitions end to end — they fail if a
 * state update drops a sibling field instead of merging it, which is the
 * regression the reducer-to-`useState` refactor could introduce.
 *
 * `useAuth` is mocked: the real hook reaches `getAuthClient()`, which
 * dynamic-imports a provider SDK Jest can't resolve (see
 * ../../__tests__/provider.test.ts).
 */

import "@/test/mockTheme";

import fs from "fs";
import path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockAuth = {
  checkAuthState: jest.fn(),
  signIn: jest.fn(),
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  resendCode: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  signOut: jest.fn(),
};

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

import { AuthScreen } from "../AuthScreen";
import { AuthError } from "../../provider";
import { useAuthStore } from "../../stores/authStore";

const EMAIL = "ada@example.com";
const PASSWORD = "password1";

function resetAuthMocks() {
  mockAuth.signIn.mockReset();
  mockAuth.signUp.mockReset();
  mockAuth.confirmSignUp.mockReset();
  mockAuth.resendCode.mockReset().mockResolvedValue(undefined);
  mockAuth.forgotPassword.mockReset();
  mockAuth.resetPassword.mockReset().mockResolvedValue(undefined);
}

async function submitSignIn(email = EMAIL, password = PASSWORD) {
  await fireEvent.changeText(screen.getByTestId("sign-in-email-input"), email);
  await fireEvent.changeText(screen.getByTestId("sign-in-password-input"), password);
  await fireEvent.press(screen.getByTestId("sign-in-submit-button"));
}

describe("AuthScreen", () => {
  beforeEach(() => {
    resetAuthMocks();
    useAuthStore.setState({ state: "unauthenticated", user: null } as never);
  });

  it("renders the sign-in view by default", async () => {
    await render(<AuthScreen />);

    expect(screen.getByTestId("sign-in-submit-button")).toBeTruthy();
    expect(screen.queryByTestId("sign-up-submit-button")).toBeNull();
  });

  it("honors initialView", async () => {
    await render(<AuthScreen initialView="sign-up" />);

    expect(screen.getByTestId("sign-up-submit-button")).toBeTruthy();
    expect(screen.queryByTestId("sign-in-submit-button")).toBeNull();
  });

  it("calls onAuthenticated when sign-in completes", async () => {
    mockAuth.signIn.mockResolvedValue({ status: "complete" });
    const onAuthenticated = jest.fn();

    await render(<AuthScreen onAuthenticated={onAuthenticated} />);
    await submitSignIn();

    expect(mockAuth.signIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("carries the pending email and password from an unconfirmed sign-in through verification", async () => {
    mockAuth.signIn
      .mockResolvedValueOnce({ status: "needsConfirmation" })
      .mockResolvedValueOnce({ status: "complete" });
    mockAuth.confirmSignUp.mockResolvedValue({ status: "complete", autoSignedIn: false });
    const onAuthenticated = jest.fn();

    await render(<AuthScreen onAuthenticated={onAuthenticated} />);
    await submitSignIn();

    // Verification view, and the code was resent for the pending email.
    expect(mockAuth.resendCode).toHaveBeenCalledWith(EMAIL);
    expect(screen.getByTestId("verify-email-code-input")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("verify-email-code-input"), "123456");
    await fireEvent.press(screen.getByTestId("verify-email-submit-button"));

    // Both pending fields survived the view switch: the code goes out with the
    // pending email, and the stored password drives the follow-up sign-in.
    expect(mockAuth.confirmSignUp).toHaveBeenCalledWith({ email: EMAIL, code: "123456" });
    expect(mockAuth.signIn).toHaveBeenNthCalledWith(2, { email: EMAIL, password: PASSWORD });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("routes a userNotConfirmed error to the verification view", async () => {
    mockAuth.signIn.mockRejectedValue(new AuthError("userNotConfirmed", "not confirmed"));

    await render(<AuthScreen />);
    await submitSignIn();

    expect(mockAuth.resendCode).toHaveBeenCalledWith(EMAIL);
    expect(screen.getByTestId("verify-email-code-input")).toBeTruthy();
  });

  it("maps sign-in error codes to friendly copy", async () => {
    mockAuth.signIn.mockRejectedValue(new AuthError("incorrectCredentials", "raw message"));

    await render(<AuthScreen />);
    await submitSignIn();

    expect(screen.getByText("Incorrect email or password.")).toBeTruthy();
    expect(screen.queryByText("raw message")).toBeNull();
  });

  it("clears the error while switching views in one update", async () => {
    mockAuth.signIn.mockRejectedValue(new AuthError("userNotFound", "raw message"));

    await render(<AuthScreen />);
    await submitSignIn();
    expect(screen.getByText("No account found with this email.")).toBeTruthy();

    await fireEvent.press(screen.getByText("auth.forgotPassword"));

    expect(screen.getByTestId("forgot-password-email-input")).toBeTruthy();
    expect(screen.queryByText("No account found with this email.")).toBeNull();
  });

  it("navigates from sign-in to sign-up and back", async () => {
    await render(<AuthScreen />);

    await fireEvent.press(screen.getByText("auth.signUp"));
    expect(screen.getByTestId("sign-up-submit-button")).toBeTruthy();

    await fireEvent.press(screen.getByText("auth.signIn"));
    expect(screen.getByTestId("sign-in-submit-button")).toBeTruthy();
  });

  it("sends a new sign-up to verification when confirmation is required", async () => {
    mockAuth.signUp.mockResolvedValue({ status: "needsConfirmation" });
    mockAuth.confirmSignUp.mockResolvedValue({ status: "complete", autoSignedIn: true });
    const onAuthenticated = jest.fn();

    await render(<AuthScreen initialView="sign-up" onAuthenticated={onAuthenticated} />);
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-up-password-input"), PASSWORD);
    await fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-up-submit-button"));

    expect(mockAuth.signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(screen.getByTestId("verify-email-code-input")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("verify-email-code-input"), "654321");
    await fireEvent.press(screen.getByTestId("verify-email-submit-button"));

    expect(mockAuth.confirmSignUp).toHaveBeenCalledWith({ email: EMAIL, code: "654321" });
    // No stored password on this path — auto sign-in is what authenticates.
    expect(mockAuth.signIn).not.toHaveBeenCalled();
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("returns a completed sign-up without a session to the sign-in view", async () => {
    mockAuth.signUp.mockResolvedValue({ status: "complete" });
    const onAuthenticated = jest.fn();

    await render(<AuthScreen initialView="sign-up" onAuthenticated={onAuthenticated} />);
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-up-password-input"), PASSWORD);
    await fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-up-submit-button"));

    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(screen.getByTestId("sign-in-submit-button")).toBeTruthy();
  });

  it("maps sign-up error codes to friendly copy", async () => {
    mockAuth.signUp.mockRejectedValue(new AuthError("userExists", "raw message"));

    await render(<AuthScreen initialView="sign-up" />);
    await fireEvent.changeText(screen.getByTestId("sign-up-email-input"), EMAIL);
    await fireEvent.changeText(screen.getByTestId("sign-up-password-input"), PASSWORD);
    await fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), PASSWORD);
    await fireEvent.press(screen.getByTestId("sign-up-submit-button"));

    expect(screen.getByText("An account with this email already exists.")).toBeTruthy();
  });

  it("moves to the reset view with the pending email when a code is sent", async () => {
    mockAuth.forgotPassword.mockResolvedValue({ status: "codeSent" });

    await render(<AuthScreen initialView="forgot-password" />);
    await fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    expect(mockAuth.forgotPassword).toHaveBeenCalledWith(EMAIL);
    expect(
      screen.getByText(`Enter the code sent to ${EMAIL} and choose a new password.`),
    ).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("reset-password-code-input"), "123456");
    await fireEvent.changeText(screen.getByTestId("reset-password-password-input"), PASSWORD);
    await fireEvent.changeText(
      screen.getByTestId("reset-password-confirm-password-input"),
      PASSWORD,
    );
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    expect(mockAuth.resetPassword).toHaveBeenCalledWith({
      email: EMAIL,
      code: "123456",
      newPassword: PASSWORD,
    });
  });

  it("shows the check-your-email state when no reset code is expected", async () => {
    mockAuth.forgotPassword.mockResolvedValue({ status: "done" });

    await render(<AuthScreen initialView="forgot-password" />);
    await fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    expect(screen.getByText("auth.checkYourEmail")).toBeTruthy();
  });

  it("does not reveal whether an account exists on forgot-password", async () => {
    mockAuth.forgotPassword.mockRejectedValue(new AuthError("userNotFound", "no such user"));

    await render(<AuthScreen initialView="forgot-password" />);
    await fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    expect(screen.getByText("auth.checkYourEmail")).toBeTruthy();
    expect(screen.queryByText("no such user")).toBeNull();
  });

  it("maps reset-password error codes to friendly copy", async () => {
    mockAuth.forgotPassword.mockResolvedValue({ status: "codeSent" });
    mockAuth.resetPassword.mockRejectedValue(new AuthError("codeMismatch", "raw message"));

    await render(<AuthScreen initialView="forgot-password" />);
    await fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), EMAIL);
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    await fireEvent.changeText(screen.getByTestId("reset-password-code-input"), "123456");
    await fireEvent.changeText(screen.getByTestId("reset-password-password-input"), PASSWORD);
    await fireEvent.changeText(
      screen.getByTestId("reset-password-confirm-password-input"),
      PASSWORD,
    );
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    expect(screen.getByText("Invalid code. Please check your email and try again.")).toBeTruthy();
  });

  it("resends the verification code from the verify view", async () => {
    mockAuth.signIn.mockResolvedValue({ status: "needsConfirmation" });

    await render(<AuthScreen />);
    await submitSignIn();
    expect(mockAuth.resendCode).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("auth.resendCodeLink"));

    expect(mockAuth.resendCode).toHaveBeenNthCalledWith(2, EMAIL);
  });

  it("keeps development logging behind logDev", () => {
    const source = fs.readFileSync(path.join(__dirname, "../AuthScreen.tsx"), "utf-8");

    expect(source).not.toMatch(/\bconsole\.log\(/);
  });
});
