import React from "react";
import { Platform } from "react-native";
import { AuthProviderGate } from "@/client/features/auth/provider/AuthProviderGate";

interface StartupGateProps {
  /** `useAppStartup().ready`. */
  ready: boolean;
  children: React.ReactNode;
}

/**
 * Root of the app tree: mounts the auth provider's context immediately and, on
 * native, withholds the app itself until startup is ready.
 *
 * The provider has to mount first because startup waits on it: Clerk loads
 * only inside `ClerkProvider`, and `useAppStartup` resolves auth through the
 * Clerk client, which waits for that load. Rendering the provider only after
 * `ready` — the old order — meant the load never started and startup sat out
 * the client's timeout under the splash. So the provider mounts with no app
 * content while the splash is up, and the app renders into the same, already
 * loaded provider once `ready` flips: the first frame after the splash is
 * styled and already knows the session. Cognito and disabled auth mount no
 * provider, so for them this is exactly the old "render nothing until ready".
 *
 * Web renders through regardless: server rendering has no splash and the first
 * paint must carry real route content.
 */
export function StartupGate({ ready, children }: StartupGateProps) {
  const holdForSplash = Platform.OS !== "web" && !ready;

  return <AuthProviderGate>{holdForSplash ? null : children}</AuthProviderGate>;
}
