let configured = false;

export async function ensureAmplifyConfigured() {
  if (configured) return;
  configured = true;

  const userPoolId = process.env.EXPO_PUBLIC_USER_POOL_ID;
  const userPoolClientId = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;

  if (!userPoolId || !userPoolClientId) {
    const missing = [
      !userPoolId && "EXPO_PUBLIC_USER_POOL_ID",
      !userPoolClientId && "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
    ].filter(Boolean).join(", ");

    if (__DEV__) {
      console.warn(`⚠️ Auth disabled — missing env vars: ${missing}`);
      return;
    }
    throw new Error(`Auth configuration failed — missing env vars: ${missing}`);
  }

  const { Amplify } = await import("aws-amplify");
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      }
    }
  });
}
