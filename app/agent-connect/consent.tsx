/**
 * PROTOTYPE: the OAuth `consentPage`. better-auth redirects here with a signed
 * copy of the authorization request. The page reads what to show from
 * `/api/auth/agent-connect/consent-info` (server-verified signed query plus
 * the client's public record), then posts the user's choice to better-auth's
 * `/api/auth/oauth2/consent` and follows the returned URL back to the client.
 *
 * Never import `server/agents/*` here (see login.tsx).
 */

import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";

interface ConsentInfo {
  client: { client_id: string; client_name: string | null; client_uri: string | null; client_id_host: string | null };
  scopes: string[];
  redirectUri: string;
  redirectHost: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  "notes:read": "Read your notes",
  "notes:write": "Add notes for you",
  offline_access: "Stay connected when you are away",
  openid: "Know who you are",
  profile: "See your name",
  email: "See your email address",
};

function signedQuery(): string {
  return Platform.OS === "web" && typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
}

export default function AgentConnectConsent() {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/auth/agent-connect/consent-info?${signedQuery()}`, { credentials: "same-origin" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setInfo(body as ConsentInfo);
      })
      .catch((reason) => setError(String(reason instanceof Error ? reason.message : reason)));
  }, []);

  async function decide(accept: boolean) {
    const response = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept, oauth_query: signedQuery() }),
    });
    const body = (await response.json().catch(() => null)) as { url?: string } | null;
    if (body?.url) window.location.assign(body.url);
    else setError(`Consent failed (${response.status})`);
  }

  if (error) return <SansSerifText>{error}</SansSerifText>;
  if (!info) return <SansSerifText>Loading…</SansSerifText>;

  const name = info.client.client_name ?? info.client.client_id;
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <SansSerifText>{`"${name}" wants to access your account`}</SansSerifText>
      {info.client.client_id_host && <SansSerifText>{`Client ID host: ${info.client.client_id_host}`}</SansSerifText>}
      <SansSerifText>It is asking to:</SansSerifText>
      {info.scopes.map((scope) => (
        <SansSerifText key={scope}>{`• ${SCOPE_LABELS[scope] ?? scope} (${scope})`}</SansSerifText>
      ))}
      <SansSerifText>{`You will be sent back to ${info.redirectHost ?? info.redirectUri}`}</SansSerifText>
      <SansSerifText>{info.redirectUri}</SansSerifText>
      <Button text="Approve" onPress={() => void decide(true)} />
      <Button text="Deny" onPress={() => void decide(false)} />
    </View>
  );
}
