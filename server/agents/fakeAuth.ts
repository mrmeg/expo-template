/**
 * PROTOTYPE: headless-test stub for the app's TokenVerifier.
 *
 * With `PROTO_FAKE_AUTH=1`, accepts `Bearer fake:<userId>:<email>` instead of
 * a Cognito token, so the e2e script can drive the session bridge without AWS.
 * Installed before `ensureAuthBootstrapped()` runs, which then keeps it
 * (the bootstrap never overwrites a preinstalled verifier).
 */

import { getTokenVerifier, setTokenVerifier } from "@/server/api/shared/auth";
import { ensureAuthBootstrapped } from "@/server/api/shared/authBootstrap";

import { isProtoFakeAuth } from "./config";

let logged = false;

export function ensureAgentTokenVerifier(): void {
  if (isProtoFakeAuth() && !getTokenVerifier()) {
    setTokenVerifier({
      async verify(token) {
        const match = /^fake:([^:]+):(.+)$/.exec(token);
        if (!match) throw new Error("not a fake token");
        return { userId: match[1]!, email: match[2]! };
      },
    });
    if (!logged) {
      logged = true;
      console.warn("[proto-agent] PROTO_FAKE_AUTH=1: stub TokenVerifier installed (accepts Bearer fake:<id>:<email>)");
    }
  }
  ensureAuthBootstrapped();
}
