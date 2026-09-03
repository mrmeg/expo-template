/**
 * Cognito client tests for the passwordless (email-code) and social flows.
 *
 * Jest can't execute `await import("./cognitoSdk")` — the babel caller is
 * `metro`, so `import()` survives the transform and the CJS VM throws
 * "A dynamic import callback was invoked without --experimental-vm-modules"
 * (same limitation ../../__tests__/provider.test.ts records). The client
 * therefore takes its SDK loader as an optional parameter whose default is the
 * single `import("./cognitoSdk")` split point; these tests pass a fake module
 * in its place, which is what makes the Amplify-facing mapping testable at all.
 */

import {
  createCognitoAuthClient,
  type CognitoSdkLoader,
} from "../cognitoClient";
import { AuthError, isAuthError } from "../types";

type HubHandler = (data: { payload: { event: string } }) => void;

const POOL_ENV_KEYS = [
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_COGNITO_DOMAIN",
] as const;

function createFakeSdk() {
  const hubHandlers: HubHandler[] = [];
  const amplifyAuth = {
    signIn: jest.fn(),
    signUp: jest.fn(),
    confirmSignUp: jest.fn(),
    confirmSignIn: jest.fn(),
    signInWithRedirect: jest.fn(),
    autoSignIn: jest.fn(),
    resendSignUpCode: jest.fn(),
    resetPassword: jest.fn(),
    confirmResetPassword: jest.fn(),
    getCurrentUser: jest.fn(),
    fetchAuthSession: jest.fn(),
    signOut: jest.fn(),
  };

  return {
    hubHandlers,
    module: {
      Amplify: { configure: jest.fn() },
      Hub: {
        listen: jest.fn((_channel: string, handler: HubHandler) => {
          hubHandlers.push(handler);
          return () => undefined;
        }),
      },
      amplifyAuth,
    },
  };
}

type FakeSdk = ReturnType<typeof createFakeSdk>;

function subject(sdk: FakeSdk) {
  const loadSdk = (async () => sdk.module) as unknown as CognitoSdkLoader;
  return createCognitoAuthClient(loadSdk);
}

function amplifyException(name: string, message = name): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** The `loginWith.oauth` block passed to the last `Amplify.configure` call. */
function oauthConfig(sdk: FakeSdk): Record<string, unknown> | undefined {
  const call = sdk.module.Amplify.configure.mock.calls.at(-1)?.[0] as
    | { Auth?: { Cognito?: { loginWith?: { oauth?: Record<string, unknown> } } } }
    | undefined;
  return call?.Auth?.Cognito?.loginWith?.oauth;
}

describe("cognito email-code sign-in", () => {
  const original: Record<string, string | undefined> = {};
  let sdk: FakeSdk;

  beforeAll(() => {
    for (const key of POOL_ENV_KEYS) original[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of POOL_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  beforeEach(() => {
    for (const key of POOL_ENV_KEYS) delete process.env[key];
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_test";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    sdk = createFakeSdk();
  });

  it("requests an email OTP through the USER_AUTH flow", async () => {
    sdk.module.amplifyAuth.signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_EMAIL_CODE" },
    });

    const result = await subject(sdk).signInWithEmailCode({ email: "ada@example.com" });

    expect(result).toEqual({ status: "needsConfirmation" });
    expect(sdk.module.amplifyAuth.signIn).toHaveBeenCalledWith({
      username: "ada@example.com",
      options: { authFlowType: "USER_AUTH", preferredChallenge: "EMAIL_OTP" },
    });
  });

  it("reports an already-signed-in result as complete", async () => {
    sdk.module.amplifyAuth.signIn.mockResolvedValue({ isSignedIn: true });

    await expect(subject(sdk).signInWithEmailCode({ email: "ada@example.com" })).resolves.toEqual({
      status: "complete",
    });
  });

  it("rejects an unsupported next step with a normalized error", async () => {
    sdk.module.amplifyAuth.signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_TOTP_CODE" },
    });

    await expect(
      subject(sdk).signInWithEmailCode({ email: "ada@example.com" }),
    ).rejects.toMatchObject({ code: "unknown" });
  });

  it("completes the in-flight sign-in with the emailed code", async () => {
    sdk.module.amplifyAuth.confirmSignIn.mockResolvedValue({ isSignedIn: true });

    const result = await subject(sdk).confirmSignInCode({ code: "123456" });

    expect(result).toEqual({ status: "complete" });
    expect(sdk.module.amplifyAuth.confirmSignIn).toHaveBeenCalledWith({
      challengeResponse: "123456",
    });
  });

  it("maps a re-issued email-code challenge to codeMismatch", async () => {
    sdk.module.amplifyAuth.confirmSignIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_EMAIL_CODE" },
    });

    await expect(subject(sdk).confirmSignInCode({ code: "000000" })).rejects.toMatchObject({
      code: "codeMismatch",
    });
  });

  it("maps a CodeMismatchException thrown by Amplify to codeMismatch", async () => {
    sdk.module.amplifyAuth.confirmSignIn.mockRejectedValue(
      amplifyException("CodeMismatchException", "Invalid code."),
    );

    const error = await subject(sdk)
      .confirmSignInCode({ code: "000000" })
      .catch((thrown: unknown) => thrown);

    expect(isAuthError(error)).toBe(true);
    expect((error as AuthError).code).toBe("codeMismatch");
  });

  it("surfaces a lost pending sign-in as an unknown error the UI can retry", async () => {
    // Amplify keeps the challenge in memory: after an app restart there is no
    // sign-in to confirm and the SDK rejects with a non-Cognito error name.
    sdk.module.amplifyAuth.confirmSignIn.mockRejectedValue(
      amplifyException("AuthSignInException", "There is no in-flight sign-in."),
    );

    await expect(subject(sdk).confirmSignInCode({ code: "123456" })).rejects.toMatchObject({
      code: "unknown",
    });
  });
});

describe("cognito password-optional sign-up", () => {
  const original: Record<string, string | undefined> = {};
  let sdk: FakeSdk;

  beforeAll(() => {
    for (const key of POOL_ENV_KEYS) original[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of POOL_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  beforeEach(() => {
    for (const key of POOL_ENV_KEYS) delete process.env[key];
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_test";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    sdk = createFakeSdk();
  });

  /** The input object handed to Amplify's `signUp` on the last call. */
  function signUpInput(): Record<string, unknown> {
    return sdk.module.amplifyAuth.signUp.mock.calls.at(-1)?.[0] as Record<string, unknown>;
  }

  it("sends no password and asks for USER_AUTH auto sign-in when none is given", async () => {
    sdk.module.amplifyAuth.signUp.mockResolvedValue({
      isSignUpComplete: false,
      nextStep: { signUpStep: "CONFIRM_SIGN_UP" },
    });

    const result = await subject(sdk).signUp({ email: "ada@example.com" });

    expect(result).toEqual({ status: "needsConfirmation" });
    // No `password` key at all: Amplify only omits Password from the Cognito
    // request when the field is absent, and USER_AUTH is how the just-confirmed
    // account gets a session without one.
    expect(signUpInput()).toEqual({
      username: "ada@example.com",
      options: {
        userAttributes: { email: "ada@example.com" },
        autoSignIn: { authFlowType: "USER_AUTH" },
      },
    });
    expect("password" in signUpInput()).toBe(false);
  });

  it("keeps the password sign-up call unchanged", async () => {
    sdk.module.amplifyAuth.signUp.mockResolvedValue({
      isSignUpComplete: false,
      nextStep: { signUpStep: "CONFIRM_SIGN_UP" },
    });

    const result = await subject(sdk).signUp({
      email: "ada@example.com",
      password: "hunter2222",
    });

    expect(result).toEqual({ status: "needsConfirmation" });
    expect(signUpInput()).toEqual({
      username: "ada@example.com",
      password: "hunter2222",
      options: {
        userAttributes: { email: "ada@example.com" },
        autoSignIn: true,
      },
    });
  });

  it("reports an auto-confirmed sign-up as complete", async () => {
    sdk.module.amplifyAuth.signUp.mockResolvedValue({
      isSignUpComplete: true,
      nextStep: { signUpStep: "COMPLETE_AUTO_SIGN_IN" },
    });

    await expect(subject(sdk).signUp({ email: "ada@example.com" })).resolves.toEqual({
      status: "complete",
    });
  });

  it("reports the pool requirement when Cognito refuses a passwordless sign-up", async () => {
    // A password-only pool rejects the Password-less SignUp request; the service
    // only complains about the parameter, so the client names the real cause.
    sdk.module.amplifyAuth.signUp.mockRejectedValue(
      amplifyException("InvalidParameterException", "Password is required."),
    );

    const error = await subject(sdk)
      .signUp({ email: "ada@example.com" })
      .catch((thrown: unknown) => thrown);

    expect(isAuthError(error)).toBe(true);
    expect((error as AuthError).code).toBe("unsupported");
    expect((error as AuthError).message).toContain("EMAIL_OTP");
    expect((error as AuthError).message).toContain("Password is required.");
  });

  it("treats a password-policy rejection of a passwordless sign-up the same way", async () => {
    sdk.module.amplifyAuth.signUp.mockRejectedValue(
      amplifyException("InvalidPasswordException", "Password did not conform with policy"),
    );

    await expect(subject(sdk).signUp({ email: "ada@example.com" })).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("leaves the password path's own password errors alone", async () => {
    sdk.module.amplifyAuth.signUp.mockRejectedValue(
      amplifyException("InvalidPasswordException", "Password did not conform with policy"),
    );

    await expect(
      subject(sdk).signUp({ email: "ada@example.com", password: "short" }),
    ).rejects.toMatchObject({ code: "invalidPassword" });
  });

  it("keeps normalizing non-pool sign-up failures on the passwordless path", async () => {
    sdk.module.amplifyAuth.signUp.mockRejectedValue(
      amplifyException("UsernameExistsException", "already exists"),
    );

    await expect(subject(sdk).signUp({ email: "ada@example.com" })).rejects.toMatchObject({
      code: "userExists",
    });
  });

  it("signs a passwordless account in through the confirmation's auto sign-in", async () => {
    sdk.module.amplifyAuth.confirmSignUp.mockResolvedValue({
      isSignUpComplete: true,
      nextStep: { signUpStep: "COMPLETE_AUTO_SIGN_IN" },
    });
    sdk.module.amplifyAuth.autoSignIn.mockResolvedValue({ isSignedIn: true });

    await expect(
      subject(sdk).confirmSignUp({ email: "ada@example.com", code: "123456" }),
    ).resolves.toEqual({ status: "complete", autoSignedIn: true });
  });

  it("still completes the confirmation when auto sign-in is gone", async () => {
    // Restarting the app between sign-up and confirmation drops Amplify's
    // in-memory auto sign-in state; the account is confirmed either way and the
    // UI falls back to email-code sign-in.
    sdk.module.amplifyAuth.confirmSignUp.mockResolvedValue({
      isSignUpComplete: true,
      nextStep: { signUpStep: "DONE" },
    });
    sdk.module.amplifyAuth.autoSignIn.mockRejectedValue(
      amplifyException("AuthSignInException", "There is no auto sign-in in progress."),
    );

    await expect(
      subject(sdk).confirmSignUp({ email: "ada@example.com", code: "123456" }),
    ).resolves.toEqual({ status: "complete", autoSignedIn: false });
  });
});

describe("cognito social sign-in", () => {
  const original: Record<string, string | undefined> = {};
  let sdk: FakeSdk;

  beforeAll(() => {
    for (const key of POOL_ENV_KEYS) original[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of POOL_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  beforeEach(() => {
    for (const key of POOL_ENV_KEYS) delete process.env[key];
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_test";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    sdk = createFakeSdk();
  });

  it("fails closed with `unsupported` when no managed-login domain is configured", async () => {
    const error = await subject(sdk)
      .signInWithProvider("google")
      .catch((thrown: unknown) => thrown);

    expect(isAuthError(error)).toBe(true);
    expect((error as AuthError).code).toBe("unsupported");
    expect((error as AuthError).message).toContain("EXPO_PUBLIC_COGNITO_DOMAIN");
    expect(sdk.module.amplifyAuth.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("omits the oauth config when no domain is set", async () => {
    await subject(sdk).init();

    expect(sdk.module.Amplify.configure).toHaveBeenCalledTimes(1);
    expect(oauthConfig(sdk)).toBeUndefined();
  });

  it("configures managed-login oauth when the domain is set", async () => {
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "https://template.auth.us-east-1.amazoncognito.com/";

    await subject(sdk).init();

    // The protocol/trailing slash are stripped: Amplify wants the bare host.
    expect(oauthConfig(sdk)).toEqual({
      domain: "template.auth.us-east-1.amazoncognito.com",
      scopes: ["openid", "email", "profile"],
      responseType: "code",
      // jest-expo reports Platform.OS === "ios", so the native scheme applies.
      redirectSignIn: ["myapp://"],
      redirectSignOut: ["myapp://"],
    });
  });

  it("launches the redirect with Amplify's capitalized provider names", async () => {
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "template.auth.us-east-1.amazoncognito.com";
    sdk.module.amplifyAuth.signInWithRedirect.mockResolvedValue(undefined);
    const client = subject(sdk);

    await client.signInWithProvider("google");
    await client.signInWithProvider("apple");

    expect(sdk.module.amplifyAuth.signInWithRedirect.mock.calls).toEqual([
      [{ provider: "Google" }],
      [{ provider: "Apple" }],
    ]);
  });

  it("normalizes a failed redirect into an AuthError", async () => {
    process.env.EXPO_PUBLIC_COGNITO_DOMAIN = "template.auth.us-east-1.amazoncognito.com";
    sdk.module.amplifyAuth.signInWithRedirect.mockRejectedValue(
      amplifyException("NotAuthorizedException", "nope"),
    );

    await expect(subject(sdk).signInWithProvider("apple")).rejects.toMatchObject({
      code: "incorrectCredentials",
    });
  });

  it("reports the redirect's Hub events through onAuthChange", async () => {
    const client = subject(sdk);
    const events: string[] = [];
    client.onAuthChange((event) => events.push(event.type));

    await client.init();
    for (const handler of sdk.hubHandlers) {
      handler({ payload: { event: "signInWithRedirect" } });
      handler({ payload: { event: "signInWithRedirect_failure" } });
    }

    expect(events).toEqual(["signedIn", "sessionExpired"]);
  });
});
