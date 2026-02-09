let configured = false;

export async function ensureAmplifyConfigured() {
  if (configured) return;
  configured = true;
  const { Amplify } = await import("aws-amplify");
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!,
      }
    }
  });
}
