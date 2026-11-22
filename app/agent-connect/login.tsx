/**
 * PROTOTYPE: the OAuth `loginPage`. better-auth's authorize endpoint redirects
 * here with a signed copy of the authorization request in the query string.
 *
 * - Signed out of the app: `AuthGate` shows the app's normal sign-in screen
 *   (emailed code). When the auth store flips to "authenticated" the gate
 *   renders `ContinueAuthorization`, which carries on without a reload.
 * - Signed in: `ContinueAuthorization` runs straight away. It sends the app's
 *   current bearer token and the signed query to the session bridge, which
 *   creates a better-auth session and answers with the next URL (consent, or
 *   the client's redirect_uri).
 *
 * The client's name comes from better-auth's pre-login lookup
 * (`/oauth2/public-client-prelogin`, signed query required).
 *
 * Never import `server/agents/*` here: that would ship pg and better-auth in
 * the web bundle.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { AuthGate } from "@/client/features/app";
import { getAuthToken } from "@/client/lib/api/authToken";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";

/** Build-time flag; the live build leaves it unset, so the test-token box never renders. */
const FAKE_AUTH_UI = process.env.EXPO_PUBLIC_PROTO_FAKE_AUTH === "1";

type Status = { kind: "working" } | { kind: "no-token" } | { kind: "error"; message: string };

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
  if (!response.ok || !data?.url) throw new Error(data?.message ?? `Could not continue (${response.status})`);
  return data.url;
}

function ContinueAuthorization() {
  const [status, setStatus] = useState<Status>({ kind: "working" });
  const [testToken, setTestToken] = useState("");

  const run = useCallback(async (token: string | undefined) => {
    if (!token) {
      setStatus({ kind: "no-token" });
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
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      {status.kind === "working" && <SansSerifText>Continuing…</SansSerifText>}
      {status.kind === "error" && <SansSerifText>{status.message}</SansSerifText>}
      {status.kind === "no-token" && <SansSerifText>Sign in to the app to continue.</SansSerifText>}
      {status.kind === "no-token" && FAKE_AUTH_UI && (
        <>
          <SansSerifText>Prototype only (PROTO_FAKE_AUTH=1): paste a test token.</SansSerifText>
          <TextInput value={testToken} onChangeText={setTestToken} placeholder="fake:<userId>:<email>" />
          <Button text="Continue with test token" onPress={() => void run(testToken.trim() || undefined)} />
        </>
      )}
    </View>
  );
}

export default function AgentConnectLogin() {
  const [clientName, setClientName] = useState<string | null>(null);

  useEffect(() => {
    const query = signedQuery();
    const clientId = new URLSearchParams(query).get("client_id");
    if (!clientId) return;
    void fetch("/api/auth/oauth2/public-client-prelogin", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, oauth_query: query }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((client: { client_name?: string } | null) => setClientName(client?.client_name ?? null))
      .catch(() => setClientName(null));
  }, []);

  return (
    <View style={{ flex: 1 }} testID="agent-connect-login">
      <View style={{ padding: 16, gap: 8 }}>
        <SansSerifText>Connect an assistant</SansSerifText>
        <SansSerifText>
          {clientName
            ? `"${clientName}" wants to connect to your account. Sign in, then review what it can do.`
            : "Sign in, then review what the assistant can do."}
        </SansSerifText>
      </View>
      <AuthGate>
        <ContinueAuthorization />
      </AuthGate>
    </View>
  );
}
