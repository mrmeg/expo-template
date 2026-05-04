import "@/test/mockTheme";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockRenderCounts = {
  cardTitle: 0,
  cardDescription: 0,
  cardContent: 0,
  cardFooter: 0,
  button: 0,
};

jest.mock("@mrmeg/expo-ui/components/Card", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  return {
    Card: ({ children, style }: any) => <View style={style}>{children}</View>,
    CardHeader: ({ children, style }: any) => <View style={style}>{children}</View>,
    CardContent: ({ children, style }: any) => {
      mockRenderCounts.cardContent += 1;
      return <View style={style}>{children}</View>;
    },
    CardFooter: ({ children, style }: any) => {
      mockRenderCounts.cardFooter += 1;
      return <View style={style}>{children}</View>;
    },
    CardTitle: ({ children }: any) => {
      mockRenderCounts.cardTitle += 1;
      return <Text>{children}</Text>;
    },
    CardDescription: ({ children }: any) => {
      mockRenderCounts.cardDescription += 1;
      return <Text>{children}</Text>;
    },
  };
});

jest.mock("@mrmeg/expo-ui/components/Button", () => ({
  Button: ({ children, disabled, onPress, testID }: any) => {
    const React = require("react");
    const { Pressable } = require("react-native");

    mockRenderCounts.button += 1;
    return (
      <Pressable disabled={disabled} onPress={onPress} testID={testID}>
        {children}
      </Pressable>
    );
  },
}));

import { SignInForm } from "../SignInForm";
import { SignUpForm } from "../SignUpForm";
import { ForgotPasswordForm } from "../ForgotPasswordForm";
import { ResetPasswordForm } from "../ResetPasswordForm";
import { VerifyEmailForm } from "../VerifyEmailForm";

function resetCounts() {
  mockRenderCounts.cardTitle = 0;
  mockRenderCounts.cardDescription = 0;
  mockRenderCounts.cardContent = 0;
  mockRenderCounts.cardFooter = 0;
  mockRenderCounts.button = 0;
}

function expectShellCountsToMatch(mountedCounts: typeof mockRenderCounts) {
  expect(mockRenderCounts.cardTitle).toBe(mountedCounts.cardTitle);
  expect(mockRenderCounts.cardDescription).toBe(mountedCounts.cardDescription);
  expect(mockRenderCounts.cardContent).toBe(mountedCounts.cardContent);
  expect(mockRenderCounts.cardFooter).toBe(mountedCounts.cardFooter);
  expect(mockRenderCounts.button).toBe(mountedCounts.button);
}

describe("auth form render churn", () => {
  beforeEach(() => {
    resetCounts();
  });

  it("keeps the SignInForm card shell stable while typing", () => {
    const onSignIn = jest.fn();

    render(
      <SignInForm
        embedded
        onForgotPassword={jest.fn()}
        onSignIn={onSignIn}
        onSignUp={jest.fn()}
        socialProviders={[]}
      />,
    );

    const mountedCounts = { ...mockRenderCounts };

    fireEvent.changeText(screen.getByTestId("sign-in-email-input"), "a@example.com");
    fireEvent.changeText(screen.getByTestId("sign-in-password-input"), "password");

    expectShellCountsToMatch(mountedCounts);

    fireEvent.press(screen.getByTestId("sign-in-submit-button"));
    expect(onSignIn).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password",
    });
  });

  it("keeps the SignUpForm card shell stable while typing", () => {
    const onSignUp = jest.fn();

    render(
      <SignUpForm
        embedded
        onSignIn={jest.fn()}
        onSignUp={onSignUp}
        socialProviders={[]}
      />,
    );

    const mountedCounts = { ...mockRenderCounts };

    fireEvent.changeText(screen.getByTestId("sign-up-name-input"), "Ada");
    fireEvent.changeText(screen.getByTestId("sign-up-email-input"), "ada@example.com");
    fireEvent.changeText(screen.getByTestId("sign-up-password-input"), "password");
    fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), "password");

    expectShellCountsToMatch(mountedCounts);

    fireEvent.press(screen.getByTestId("sign-up-submit-button"));
    expect(onSignUp).toHaveBeenCalledWith({
      name: "Ada",
      email: "ada@example.com",
      password: "password",
    });
  });

  it("keeps the ForgotPasswordForm card shell stable while typing", () => {
    const onSubmit = jest.fn();

    render(
      <ForgotPasswordForm
        embedded
        onBack={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const mountedCounts = { ...mockRenderCounts };

    fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), "ada@example.com");

    expectShellCountsToMatch(mountedCounts);

    fireEvent.press(screen.getByTestId("forgot-password-submit-button"));
    expect(onSubmit).toHaveBeenCalledWith("ada@example.com");
  });

  it("keeps the ResetPasswordForm card shell stable while typing", () => {
    const onSubmit = jest.fn();

    render(
      <ResetPasswordForm
        embedded
        onBack={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const mountedCounts = { ...mockRenderCounts };

    fireEvent.changeText(screen.getByTestId("reset-password-code-input"), "123456");
    fireEvent.changeText(screen.getByTestId("reset-password-password-input"), "password1");
    fireEvent.changeText(screen.getByTestId("reset-password-confirm-password-input"), "password1");

    expectShellCountsToMatch(mountedCounts);

    fireEvent.press(screen.getByTestId("reset-password-submit-button"));
    expect(onSubmit).toHaveBeenCalledWith({
      code: "123456",
      newPassword: "password1",
    });
  });

  it("keeps the VerifyEmailForm card shell stable while typing", () => {
    const onVerify = jest.fn();

    render(
      <VerifyEmailForm
        embedded
        email="ada@example.com"
        onBack={jest.fn()}
        onVerify={onVerify}
      />,
    );

    const mountedCounts = { ...mockRenderCounts };

    fireEvent.changeText(screen.getByTestId("verify-email-code-input"), "12");
    fireEvent.changeText(screen.getByTestId("verify-email-code-input"), "12a34567");

    expectShellCountsToMatch(mountedCounts);

    fireEvent.press(screen.getByTestId("verify-email-submit-button"));
    expect(onVerify).toHaveBeenCalledWith("123456");
  });
});
