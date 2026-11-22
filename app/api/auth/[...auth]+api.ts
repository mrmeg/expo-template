/**
 * PROTOTYPE: better-auth's handler for every `/api/auth/*` path — OAuth 2.1
 * authorize/token/register/revoke/consent, JWKS, the session bridge, and the
 * issuer-relative discovery documents — plus the consent page's data read,
 * kept in this bundle rather than a separate route bundle.
 */

import { auth } from "@/server/agents/auth";
import { CONSENT_INFO_PATH, handleConsentInfo } from "@/server/agents/consentInfo";

export function GET(request: Request): Promise<Response> {
  if (new URL(request.url).pathname === CONSENT_INFO_PATH) {
    return handleConsentInfo(request);
  }
  return auth.handler(request);
}

export function POST(request: Request): Promise<Response> {
  return auth.handler(request);
}
