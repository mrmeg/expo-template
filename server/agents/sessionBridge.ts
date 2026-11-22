/**
 * PROTOTYPE: the session bridge — turns a caller the app already
 * authenticated (Cognito/Clerk bearer, verified by the template's
 * `requireAuthenticatedUser`) into a better-auth browser session, so the OAuth
 * authorize flow continues to consent with no second login.
 *
 * Mechanism: a better-auth plugin endpoint (`POST /api/auth/agent-bridge/sign-in`).
 * The OAuth provider's own hooks do the resume:
 *   - a `before` hook on any endpoint whose body carries `oauth_query`
 *     verifies the signed authorize query and stashes it;
 *   - an `after` hook on any endpoint whose response sets the session cookie
 *     re-runs `/oauth2/authorize` and replaces the body with
 *     `{ redirect: true, url }` (the consent page, or the client's
 *     redirect_uri when consent is already on file).
 * So this endpoint only has to (1) verify the app credential, (2) upsert the
 * user keyed by the external id, (3) create a session and set its cookie.
 *
 * better-auth APIs used:
 *   - public:   createAuthEndpoint, APIError, sessionMiddleware (better-auth/api),
 *               setSessionCookie (better-auth/cookies)
 *   - plugin-context (documented for plugin authors as "internal db calls"):
 *               ctx.context.internalAdapter.findAccountOwnerByKey,
 *               findUserByEmail, createOAuthUser, linkAccount, createSession;
 *               ctx.context.adapter.updateMany/deleteMany (disconnect)
 */

import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

import { requireAuthenticatedUser } from "@/server/api/shared/auth";

import { BRIDGE_PROVIDER_ID } from "./config";
import { ensureAgentTokenVerifier } from "./fakeAuth";

export const agentSessionBridge = () =>
  ({
    id: "agent-session-bridge",
    endpoints: {
      agentBridgeSignIn: createAuthEndpoint(
        "/agent-bridge/sign-in",
        {
          method: "POST",
          body: z.object({ oauth_query: z.string().optional() }),
          requireHeaders: true,
        },
        async (ctx) => {
          ensureAgentTokenVerifier();
          const request = ctx.request ?? new Request(ctx.context.baseURL, { headers: ctx.headers });
          const auth = await requireAuthenticatedUser(request);
          if (!auth.ok) {
            throw new APIError("UNAUTHORIZED", { message: "App sign-in required" });
          }

          const externalId = auth.user.userId;
          const email = (auth.user.email ?? `${externalId}@users.invalid`).toLowerCase();
          const adapter = ctx.context.internalAdapter;

          const owned = await adapter.findAccountOwnerByKey({
            providerId: BRIDGE_PROVIDER_ID,
            accountId: externalId,
          });

          let user;
          if (owned?.kind === "owned") {
            user = owned.user;
          } else {
            const byEmail = await adapter.findUserByEmail(email);
            if (byEmail) {
              user = byEmail.user;
              await adapter.linkAccount({ providerId: BRIDGE_PROVIDER_ID, accountId: externalId, userId: user.id });
            } else {
              const created = await adapter.createOAuthUser(
                { email, name: auth.user.username ?? email, emailVerified: true, image: null },
                { providerId: BRIDGE_PROVIDER_ID, accountId: externalId },
              );
              user = created.user;
            }
          }

          const session = await adapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          // Replaced by the OAuth provider's after-hook with { redirect, url }
          // when the body carried a valid oauth_query.
          return ctx.json({ ok: true, userId: user.id });
        },
      ),

      /**
       * User-initiated "disconnect this assistant". better-auth 1.7.27 has no
       * user-facing endpoint that ends a client's grant: `/oauth2/delete-consent`
       * only deletes the consent row (refresh tokens keep working) and
       * `/oauth2/revoke` (RFC 7009) needs the client's own token and client
       * authentication. So this marks the user's tokens for the client revoked
       * and deletes the consent, through the plugin-context adapter
       * (`ctx.context.adapter`, i.e. raw table writes on oauthRefreshToken /
       * oauthAccessToken / oauthConsent).
       */
      agentDisconnect: createAuthEndpoint(
        "/agent-bridge/disconnect",
        {
          method: "POST",
          body: z.object({ clientId: z.string().min(1) }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id;
          const where = [
            { field: "userId", value: userId },
            { field: "clientId", value: ctx.body.clientId },
          ];
          const revoked = new Date();
          const adapter = ctx.context.adapter;
          const refreshTokens = await adapter.updateMany({ model: "oauthRefreshToken", where, update: { revoked } });
          const accessTokens = await adapter.updateMany({ model: "oauthAccessToken", where, update: { revoked } });
          const consents = await adapter.deleteMany({ model: "oauthConsent", where });
          return ctx.json({ revokedRefreshTokens: refreshTokens, revokedAccessTokens: accessTokens, deletedConsents: consents });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
