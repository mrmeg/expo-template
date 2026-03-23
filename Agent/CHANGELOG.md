# Changelog

## [Unreleased]

### Added
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
