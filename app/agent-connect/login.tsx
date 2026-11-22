/**
 * PROTOTYPE: the OAuth `loginPage`. better-auth's authorize endpoint redirects
 * here with a signed copy of the authorization request in the query string.
 *
 * The user is already signed in to the app (Cognito/Clerk), so this page does
 * not ask for a password: it sends the app's current bearer token and the
 * signed query to the session bridge, which creates a better-auth session and
 * answers with the next URL (consent, or the client's redirect_uri).
 *
 * Never import `server/agents/*` here: that would ship pg and better-auth in
 * the web bundle.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { getAuthToken } from "@/client/lib/api/authToken";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";

type Status = { kind: "working" } | { kind: "needs-app-sign-in" } | { kind: "error"; message: string };

function signedQuery(): string {
  return Platform.OS === "web" && typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
}

async function bridge(token: string): Promise<string> {
  const response = await fetch("/api/auth/agent-bridge/sign-in", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ oauth_query: signedQuery() }),
  });
  const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
  if (!response.ok || !data?.url) throw new Error(data?.message ?? `Bridge failed (${response.status})`);
  return data.url;
}

export default function AgentConnectLogin() {
  const [status, setStatus] = useState<Status>({ kind: "working" });
  const [testToken, setTestToken] = useState("");

  const run = useCallback(async (token: string | undefined) => {
    if (!token) {
      setStatus({ kind: "needs-app-sign-in" });
      return;
    }
    setStatus({ kind: "working" });
    try {
      window.location.assign(await bridge(token));
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  useEffect(() => {
    void getAuthToken().then(run);
  }, [run]);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <SansSerifText>Connect an assistant</SansSerifText>
      {status.kind === "working" && <SansSerifText>Checking your sign-in…</SansSerifText>}
      {status.kind === "error" && <SansSerifText>{status.message}</SansSerifText>}
      {status.kind === "needs-app-sign-in" && (
        <>
          <SansSerifText>Sign in to the app in this browser, then reload this page.</SansSerifText>
          <SansSerifText>Prototype only (PROTO_FAKE_AUTH=1): paste a test token.</SansSerifText>
          <TextInput value={testToken} onChangeText={setTestToken} placeholder="fake:<userId>:<email>" />
          <Button text="Continue with test token" onPress={() => void run(testToken.trim() || undefined)} />
        </>
      )}
    </View>
  );
}
