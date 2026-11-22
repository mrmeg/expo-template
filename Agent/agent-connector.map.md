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

## Tickets
- [ ] research: What must an authorization server provide for Claude, ChatGPT and Gemini to connect to a custom remote MCP server (protected resource metadata, Dynamic Client Registration or client ID metadata documents, PKCE, callback URLs, token lifetimes), and can Cognito fill that role or must the app server issue its own tokens after a Cognito sign-in?
- [ ] research: Which TypeScript MCP server library runs as a stateless Streamable HTTP handler inside an Expo Router API route on Bun and on Terlo's Express server, under spec `2026-07-28`?
- [ ] research: What do Claude's Connectors Directory and ChatGPT's app directory each require in full (review criteria, privacy policy, reviewer test access, ChatGPT's ban on selling digital products), and which of those bind the package rather than each app?
- [ ] research: What do Terlo's, Downrange Days' and Housefold's push paths each do today (transport, token storage, categories, collapse ids, interruption levels, Android), and what must a shared module keep?
- [ ] grill: One package holding connector, activity log and push, or push as its own package since it is useful without agents?
- [ ] grill: The template has no database: does the package ship a storage interface plus a reference Drizzle schema that each app migrates itself, or own its tables and migrations?
- [ ] grill: Who issues connector tokens: the package's own minimal authorization server, or Cognito? (blocked by the authorization research)
- [ ] grill: Which writes apply at once with undo and which wait for an in-app confirmation (money, publishing, deleting, messaging other people), and how does a tool declare which it is?
- [ ] grill: Is undo required of every write tool or opt-in per tool, and how long is the window?
- [ ] grill: Which notification categories exist, which are on by default, and what can a user mute (per category, per connection)? (blocked by the push research)
- [ ] grill: Where does a user approve a connection (web only, as Housefold does, or in the native app too), does approval need a recent sign-in, and is there an API key path for clients without OAuth?
- [ ] grill: In a multi-tenant app, how does a connection choose what it acts on: one scope set per user, or per business or organizer team?
- [ ] grill: What are Terlo's first tools for attendees and for organizers, and is public event discovery without sign-in part of the first version?
- [ ] grill: Does the template ship a working demo connector, given it has no database?
- [ ] prototype: A throwaway connector on the Railway `expo-template` service with one read tool and one write tool over the template's echo route, connected from Claude web and then used from Claude on a phone, to prove OAuth and mobile use end to end. (blocked by the authorization and library research)

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
