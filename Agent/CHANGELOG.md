# Changelog

## [Unreleased]

### Added
- **Showcase Component Demos** — Added Badge, Card, Label, and AnimatedView sections to the component showcase.
- **Test Coverage Expansion** — Added 10 new test files: useTheme, useStaggeredEntrance hooks; Progress, Tabs, InputOTP, Switch, Checkbox, Select components; themeStore, globalUIStore stores.

### Fixed
- **InputOTP autoFocus** — Changed default from `true` to `false` to prevent scroll-to-bottom on mount.
- **Progress Web Crash** — Removed `StyleSheet.flatten()` from Reanimated animated styles.
- **Tabs Text-in-View Error** — Wrapped string children in `StyledText` inside `TabsTrigger`.
- **Accessibility** — Added `accessibilityRole` to Drawer trigger/backdrop/close, InputOTP cells. Marked Accordion chevron icon as decorative.

### Added
- **Stripe Webhook Overhaul** — Expanded webhook coverage from 2 to 12 event types: refunds (including external Dashboard refunds), disputes/chargebacks, session expiry (releases seat holds), failed payments (analytics), and full subscription lifecycle (real-time updates). Added deduplication via `stripe_webhook_events` table.
- **Dispute Tracking** — New `stripe_disputes` table tracks chargebacks with organizer notifications.

### Fixed
- **Cron Auth** — Payment reconciliation cron now requires `CRON_SECRET` Bearer token (was previously unauthenticated).
- **External Refunds** — Refunds initiated from Stripe Dashboard now create refund records and update ticket status.

### Improved
- **Reconciliation Cron** — Downgraded from 24h to 1h window. Fires Sentry warning when orphaned payments found (indicates webhook failure).
- **Stripe Service Consolidation** — Merged duplicate `server/lib/stripe/stripe-service.ts` into canonical service. `createAccountLink` now returns login link for fully onboarded accounts.

### Removed
- **Dead Code Cleanup** — Removed legacy `createTicketCheckoutSession` (incompatible metadata), `createCheckoutSession` (unused subscription function), dead `getPlatformEventTicketPayments` method, and unused `donations` table.

### Improved
- **Split Large Screen Files** — Extracted 23 focused components from 7 screen files (total: ~8,300→3,861 lines). Improves maintainability and enables targeted memoization.
- **React.memo on List Items** — Wrapped 12 list item components with React.memo to prevent unnecessary re-renders during scrolling, filtering, and searching.
- **Standardized API Errors** — All 233 API error responses now use a consistent `apiError()` helper with shape `{ error, code?, details? }`. ESLint rule prevents new `console.log` in API routes.

### Fixed
- **Polling Memory Leak** — Fixed campaign status polling in admin tickets page that continued firing after navigation. Added cleanup refs to stop timeouts on unmount.

### Removed
- **Agent API System** — Removed 4 agent API endpoints, auth middleware, key generation script, and 3 database tables. Featured curation now runs as a server-side cron.
- **215 console.log Statements** — Removed from all API routes. ESLint `no-console` rule added to prevent regression.

### Documentation
- **globalUIStore Pattern** — Documented the non-reactive ReactNode storage pattern and verified all consumers.

### Added
- **Featured Events Cron** — Server-side daily cron job (`POST /api/cron/featured`) that automatically curates featured events. Runs at 5 AM ET: cleans up stale featured events, scores candidates using engagement metrics + GPT-4o-mini, applies changes, and notifies admins. Replaces the removed external OpenClaw agent.

### Fixed
- **Admin Tickets Crash** — Fixed a crash on the admin Tickets tab caused by an invalid CSS `linear-gradient()` used as a React Native `backgroundColor`. Replaced with a theme-aware solid color.
- **Header Icons in Status Bar** — Fixed header icons (notification bell, profile button) remaining visible in the status bar area when scrolling down on the Explore page. The scroll-hide animation now accounts for the safe area inset height.
- **Production Hardening** — Removed insecure Stripe debug endpoint that leaked full account details. Cleaned 73 debug console.log statements from API routes (some logged PII). Added NaN validation and bounds capping to pagination params across 7 routes.
- **Follow Organizer Button** — Removed non-functional Follow button from organizer profile page (was wired to console.log no-op).
- **Scraper Parser** — Replaced fragile regex-based HTML extraction in the Terre Haute event detail parser with node-html-parser DOM queries. Handles nested elements and attribute variations correctly.

### Testing
- **Critical Path Tests** — Added 31 unit tests for Stripe refunds, ticket creation service, and purchase validation. Coverage includes pure function tests (calculateRefundAmounts, validateRegistrationData, separateFreeAndPaid) and mocked async tests (processPaymentSuccess, checkRefundEligibility).

### Accessibility
- **Ticket Screen Labels** — Added VoiceOver/TalkBack labels to ticket list items, purchase buttons, wallet/calendar/directions action buttons across 4 ticket screen files.

### Improved
- **Admin Architecture Refactor (complete)** — Restructured admin navigation from flat 9-tab bar to grouped sections (People, Events & Tickets, Content). Mobile now uses a compact scrollable pill-tab row instead of overflowing grouped layout. Created 7 shared admin UI components. Migrated all admin data from Zustand stores to TanStack Query hooks (useAdminEvents, useAdminBusinesses). Removed adminEventStore.ts and adminBusinessStore.ts (−935 net lines). Decomposed 6 monolith components (CommsContent 1453→252, TicketsContent 737→193, BusinessesContent 555→292, etc.) into 12 focused sub-components. Query key factory is now the single source of truth for all admin cache keys.
- **Admin Dashboard Performance** — Consolidated Tickets tab from two API calls to one. Added pagination to Users and Tickets tabs. Wrapped lazy-loaded tabs in error boundaries so a crash in one tab doesn't take down the dashboard. Memoized list renderers. Added 30-second server-side cache for dashboard stats. Added skeleton loading for user activity expansion.

### Added
- **CRM-Style User Detail Page** — New /admin/users/[id] page consolidating tickets, events, communications, and businesses into a single tabbed view. Replaces the old expandable-row pattern with a dedicated detail page.
- **Add to Calendar** — Event detail page now has an "Add to Calendar" button for all events. Web shows a dropdown (Google Calendar, Outlook, .ics download). Native shares an .ics file directly.

- **Event Detail Urgency & Social Proof** — Event detail pages now show "Selling fast" and "Only X left" badges on the registration card when tickets are running low. An "{X} attending" count appears in the metadata section when 5+ tickets have been sold. The mobile bottom CTA bar reflects urgency labels.
- **Ticket Post-Purchase Enhancements** — My Tickets view now highlights today's events with an accent border and shows day names ("This Saturday") instead of "In 3 days" for events within a week. Quick-action buttons (Directions, View Event, Show Ticket) appear on upcoming event cards.
- **Featured Page Time-Aware Sections** — The Featured page now organizes events into "Happening Tonight", "Tomorrow", "This Weekend", and "Coming Up" sections instead of a flat grid, making the home screen feel more alive and contextual.
- **Explore Scroll-to-Hide Header** — On mobile, the Explore page header now hides when scrolling down and reappears when scrolling up, giving more screen space for browsing events.
- **Mobile Bottom Tab Bar** — Replaced the hamburger drawer with a persistent bottom tab bar on mobile (5 tabs: Featured, Explore, My Events, Alerts, Profile). Desktop sidebar remains unchanged. Notification badge shows as a red dot when there are unread alerts.
- **Explore Date-Grouped Sections** — Events on the explore page are now grouped by date with sticky section headers. Headers display "Today", "Tomorrow", or "DayOfWeek, MonthShort Day" for future dates. Infinite scroll continues to work across date sections.

### Changed
- Sub-page side panels (e.g., event detail panels) still use the mobile drawer when `subPageDrawer.hasContent` is true.
- Hamburger menu icon removed from header left on mobile — no longer needed with tab bar.
- Explore page now uses `useDimensions()` hook instead of manual `Dimensions.addEventListener`.
