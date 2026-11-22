---
status: wayfinding
base-branch: dev
---

# Agent connector package

## Destination
Specs for a published package, alongside `@mrmeg/expo-purchases`, that lets a Cognito + Postgres Expo app be worked by its user's own AI assistant: a remote MCP connector with OAuth, scoped read and write tools, an agent activity log with undo, a "connected agents" screen, and push notifications for agent activity. The last spec adopts it in Terlo. SimpleSell, Relata and Downrange Days follow from the same specs and are not mapped here.

## Notes
- Design reference, not a code source: Housefold (`~/Development/housefold`) runs on `@convex-dev/mcp`, an alpha Convex component that supplies the OAuth server and connection storage. Read `convex/mcp.ts` (scopes, the four annotation hints, `returns` as the field allowlist, idempotency keys), `convex/agentActivity.ts` (log, 24-hour undo), `convex/lib/mcpErrors.ts`, `client/features/agents/` (consent, connect sheet, connected agents screen) and `convex/pushAlerts.ts`.
- The template has no database and no push code. Its server is Expo Router API routes behind `server.bun.ts`, with Cognito and Clerk token verifiers in `server/api/shared/`.
- Existing push: Terlo uses `expo-server-sdk` (`server/notifications/`), Downrange Days has `server/services/push.service.ts`, Housefold sends direct APNs and has no Android push.
- Terlo's one database backs prod, preview, Staging and local: no prototype or spec may write to it outside a reviewed migration.
- Facts checked 2026-11-22: Claude bars third-party use of plan credentials; a connector connected on Claude web or desktop works in the iOS and Android apps at next login; installing from mobile is beta and unconfirmed for custom connectors; Claude's callback is `https://claude.ai/api/mcp/auth_callback` and it supports Dynamic Client Registration; MCP sampling is deprecated as of spec `2026-07-28`.
- Directory rules already known: every tool needs a `title` and the applicable hint (`readOnlyHint` or `destructiveHint`); a tool that mixes reads and writes is rejected; submitting needs a paid Claude plan.
- Skills to consult: `claude-api` for MCP and tool-definition detail, `ui-layout` for the connected agents screen.

## Decisions so far
- Which direction first: the app goes into the user's assistant through a connector. No in-app chat in any app for now, Terlo included.
- Where it lives: a published package in this repo, not copied template code.
- First consumer: Terlo.
- Agent writes are in scope from the start: a user tells their agent to change something and the agent completes it.
- Notifications: every agent write is logged; push only for actions that affect other people, high-stakes actions, requests awaiting confirmation, and broken connections.
- Build to Claude's Connectors Directory rules from the first version.
- What authorization must provide (MCP spec `2026-07-28`, checked 2026-11-22): the connector serves Protected Resource Metadata (RFC 9728), answers 401 with `WWW-Authenticate: Bearer resource_metadata=…`, and accepts only tokens whose audience is itself (RFC 8707). The authorization server needs discovery metadata listing `code_challenge_methods_supported` with S256, and should return `iss` (RFC 9207). Client registration order is pre-registered, then client ID metadata documents, then Dynamic Client Registration, which that revision deprecates. Claude and ChatGPT both try metadata documents first and fall back to registration; ChatGPT's callback is `https://chatgpt.com/connector_platform_oauth_redirect`, or `https://chatgpt.com/connector/oauth/{callback_id}` without RFC 9207. Claude refreshes five minutes before expiry and needs `invalid_grant` on a dead refresh token.
- Cognito can be the authorization server: AWS documents Dynamic Client Registration at `https://{pool domain}/oauth2/register` on the Essentials and Plus plans when every pool domain uses managed login, with open registration, public clients on PKCE S256, and the `resource` parameter setting the token's `aud`. Its limits: registered clients cannot be updated or deleted by the client and never expire, a pool holds 10,000 app clients, and no client ID metadata document support is documented. The fleet's pools already need Essentials or Plus for emailed sign-in codes (`scripts/cognito-preflight.ts` in Terlo). Unconfirmed: whether Cognito's discovery document lists `code_challenge_methods_supported`, and Gemini's consumer-app requirements.
- What the directories require (checked 2026-11-22). The package can enforce: every tool has a `title`, a unique name of 64 characters or fewer, and `readOnlyHint`, `destructiveHint` and `openWorldHint` each set explicitly (ChatGPT requires all three); writes split into create, update and delete tools with no generic executor; descriptions that match behavior and neither direct the assistant to other tools nor promote anything; actionable errors; 401 with `resource_metadata`; refresh-token rotation; token endpoint answers within 10 s; both assistants' redirect URIs. Each app supplies: privacy policy, terms, support contact, icon and docs; for ChatGPT a verified identity, five positive and three negative test cases, a video and reviewer credentials; for Claude a paid plan to submit and a demo account if Verified review asks. Claude lists submissions as Community after an automatic scan.
- Directory limits on money: Claude's directory policy prohibits software that "transfers money or other financial assets" or transacts "without human checks". ChatGPT allows commerce for physical goods only, through external checkout on the developer's own domain, and bans showing plans or linking plan-gated features straight to checkout; it does not address event tickets. So agent tools never move money: buying, refunding and payouts hand off to the app.
- Unlisted connectors by assistant: Claude accepts a pasted URL on every plan (one on Free) with write tools. ChatGPT's help center says custom servers are read-only on Pro and write-capable only on Business, Enterprise and Edu, on web only, while its developer docs state no plan limit: unresolved, and it decides whether ChatGPT users can make agent writes before a directory listing. Gemini links MCP servers through Connected Apps, which is access-by-form and needs a `/.well-known/google-connected-apps` file; its reach into the consumer app is unconfirmed.
- Server library (checked 2026-11-22): the official v2 package `@modelcontextprotocol/server` (2.4.0) is the only maintained option implementing spec `2026-07-28`. Its `createMcpHandler` is a web-standard `(Request) => Promise<Response>` handler, stateless by default, needs zod 4 (the template has 4.6), lists Bun as supported, and covers `title`, annotations, `outputSchema` and server `instructions`; it still negotiates the 2025 revisions. The v1 package `@modelcontextprotocol/sdk` stops at `2025-11-25`. `mcp-handler` wraps v2 and adds bearer-auth and protected-resource helpers; `@hono/mcp` and `fastmcp` wrap v1. Spec `2026-07-28` removed sessions and the `initialize` handshake, so a stateless handler is the standard shape. Untested, for the prototype to prove: an Expo Router API route streaming a response and bundling the package, and Bun's 10 s idle timeout against the SDK's 15 s keep-alive.
- Libraries that could supply an authorization layer instead: `@better-auth/oauth-provider` (registration, metadata documents, PKCE, RFC 8707) and `cloudflare/workers-oauth-provider` (Workers only).

## Tickets
- [ ] research: What do Terlo's, Downrange Days' and Housefold's push paths each do today (transport, token storage, categories, collapse ids, interruption levels, Android), and what must a shared module keep?
- [ ] grill: One package holding connector, activity log and push, or push as its own package since it is useful without agents?
- [ ] grill: The template has no database: does the package ship a storage interface plus a reference Drizzle schema that each app migrates itself, or own its tables and migrations?
- [ ] grill: Who issues connector tokens: Cognito directly (no token code to write or secure; but its managed login has no scope-by-scope consent page of ours, registered clients never expire, and it offers only the registration method MCP now deprecates), or an authorization layer in the package that signs users in through Cognito and owns consent, scopes and the connection list as Housefold does?
- [ ] task: With a fresh `aws login`, read Terlo's user pool (feature plan, managed login on every domain, `DcrConfiguration`, resource servers, app client count) to confirm Cognito's registration endpoint could be switched on there. (needs Matt's `aws login`; only matters if Cognito issues the tokens)
- [ ] grill: Which writes apply at once with undo and which wait for an in-app confirmation (money, publishing, deleting, messaging other people), and how does a tool declare which it is?
- [ ] grill: Is undo required of every write tool or opt-in per tool, and how long is the window?
- [ ] grill: Which notification categories exist, which are on by default, and what can a user mute (per category, per connection)? (blocked by the push research)
- [ ] grill: Where does a user approve a connection (web only, as Housefold does, or in the native app too), does approval need a recent sign-in, and is there an API key path for clients without OAuth?
- [ ] grill: In a multi-tenant app, how does a connection choose what it acts on: one scope set per user, or per business or organizer team?
- [ ] grill: What are Terlo's first tools for attendees and for organizers, and is public event discovery without sign-in part of the first version?
- [ ] grill: Does the template ship a working demo connector, given it has no database?
- [ ] prototype: A throwaway connector on the Railway `expo-template` service with one read tool and one write tool over the template's echo route, connected from Claude web and then used from Claude on a phone, to prove OAuth and mobile use end to end, and that an Expo Router API route on Bun can serve the v2 handler (streaming, bundling, idle timeout). (blocked by the token-issuer decision)

## Not yet specified
- How text written by other users is marked as data so an agent cannot be steered by it, beyond Housefold's server instructions.
- Rate limits and abuse controls per connection.
- Keeping tool schemas compatible across app releases once assistants have cached them.
- Whether Housefold adopts any of the package's client pieces while its server stays on the Convex component.
- When and under whose name connectors are submitted to the directories.

## Out of scope
- In-app chat and any use of a user's AI subscription inside the apps: decided against for now; Claude forbids it and ChatGPT's version is waitlisted.
- Operating-system assistants (App Intents, Android AppFunctions): a separate native effort, revisited once connectors are live.
- Agent checkout standards: still unsettled; purchases hand off to each app's own checkout.
- Tool sets for SimpleSell, Relata and Downrange Days: each gets its own spec after Terlo proves the package.
