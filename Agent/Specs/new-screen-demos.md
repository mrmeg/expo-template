# Spec: New Screen Template Demos

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What

Create demo route files for the 8 screen templates that have no demo routes: CardGrid, Chat, Dashboard, Form, NotificationList, SearchResults, Error, and DetailHero (fix existing broken route). Add entries to the Explore tab for all new demos. Fix the stale screen template count on the Explore tab.

## Why

The project has 13 screen templates in `client/screens/` but only 5 have demo routes (Settings, Profile, List, Pricing, Welcome). The remaining 8 are invisible to template users browsing the Explore tab. Screen templates are a major selling point of the template -- users need to see them in action to understand what is available and how to use them. The existing DetailHero demo exists at `app/(main)/(demos)/detail-hero.tsx` but is not listed in the screen templates grid on the Explore tab.

## Current State

- **Screen templates with demos:** SettingsScreen, ProfileScreen, ListScreen, PricingScreen, WelcomeScreen (5 routes in `app/(main)/(demos)/screen-*.tsx`).
- **Screen templates without demos:** CardGridScreen, ChatScreen, DashboardScreen, FormScreen, NotificationListScreen, SearchResultsScreen, ErrorScreen (7 missing routes). DetailHero has a route at `app/(main)/(demos)/detail-hero.tsx` but is listed under "Demos & Tools" instead of "Screen Templates".
- **Explore tab** (`app/(main)/(tabs)/index.tsx`): The `screenTemplates` array has 5 entries. The `demos` array has 5 entries including `detail-hero`.
- **Main layout** (`app/(main)/_layout.tsx`): Stack.Screen entries exist only for the 5 existing demo routes plus `detail-hero`.
- Screen templates accept props for data, callbacks, and configuration. Each existing demo file creates sample data and passes it to the template component (see `screen-list.tsx` and `screen-settings.tsx` for the pattern).

## Changes

### 1. Create demo route: CardGrid

**New file:** `app/(main)/(demos)/screen-card-grid.tsx`

- Import `CardGridScreen` from `@/client/screens/CardGridScreen`.
- Create sample data: 8-12 card items with titles, descriptions, icons, and categories (e.g., a recipe collection or product catalog).
- Define 3-4 category filters (e.g., "All", "Popular", "Recent", "Favorites").
- Render `<CardGridScreen>` with sample cards, categories, onPress handler, and onRefresh.

### 2. Create demo route: Chat

**New file:** `app/(main)/(demos)/screen-chat.tsx`

- Import `ChatScreen` from `@/client/screens/ChatScreen`.
- Create sample conversation data: 10-15 messages between two participants with mixed statuses (sending, sent, delivered, read).
- Include a mix of short and long messages, timestamps spanning a realistic conversation.
- Wire `onSend` to append new messages to local state.
- Set current user ID so messages render on the correct side.

### 3. Create demo route: Dashboard

**New file:** `app/(main)/(demos)/screen-dashboard.tsx`

- Import `DashboardScreen` from `@/client/screens/DashboardScreen`.
- Create sample metric cards: 4 metrics (e.g., Revenue, Users, Orders, Conversion) with trends (up/down/flat) and trend values.
- Add 3-4 quick action items with icons.
- Include a time period toggle (e.g., "7d", "30d", "90d") using the `timePeriods` prop if available.
- Add sample activity/recent items list.

### 4. Create demo route: Form

**New file:** `app/(main)/(demos)/screen-form.tsx`

- Import `FormScreen` from `@/client/screens/FormScreen`.
- Create a multi-step form demo (e.g., user registration: Personal Info, Address, Preferences).
- Each step should render 2-3 form fields using the `content` render prop.
- Use `react-hook-form` for form state (as FormScreen expects `UseFormReturn`).
- Include field validation rules to demonstrate error states.

### 5. Create demo route: NotificationList

**New file:** `app/(main)/(demos)/screen-notifications.tsx`

- Import `NotificationListScreen` from `@/client/screens/NotificationListScreen`.
- Create sample notification data: 10-15 notifications grouped by time (Today, Yesterday, Earlier).
- Mix read and unread notifications with different icons and types.
- Wire mark-as-read and dismiss handlers to local state.
- Include pull-to-refresh.

### 6. Create demo route: SearchResults

**New file:** `app/(main)/(demos)/screen-search.tsx`

- Import `SearchResultsScreen` from `@/client/screens/SearchResultsScreen`.
- Create sample search results: 8-10 result items with titles, descriptions, and metadata.
- Define 3-4 filter options (e.g., "All", "Articles", "Products", "People").
- Wire search input to filter results by query text.
- Show empty state when no results match.

### 7. Create demo route: Error

**New file:** `app/(main)/(demos)/screen-error.tsx`

- Import `ErrorScreen` from `@/client/screens/ErrorScreen`.
- Create a demo that cycles through all error variants: `not-found`, `offline`, `maintenance`, `permission-denied`, `generic`.
- Use buttons or a selector to switch between variants.
- Each variant should show with appropriate actions (e.g., "Go Home", "Retry", "Contact Support").

### 8. Update Explore tab screen templates

**File:** `app/(main)/(tabs)/index.tsx`

Update the `screenTemplates` array to include all 13 screen templates:

```ts
const screenTemplates: NavItem[] = [
  { href: "/(main)/(demos)/screen-settings", icon: "sliders", label: "Settings", description: "Grouped lists & toggles" },
  { href: "/(main)/(demos)/screen-profile", icon: "user", label: "Profile", description: "Avatar, stats, sections" },
  { href: "/(main)/(demos)/screen-list", icon: "list", label: "List", description: "Search & pull to refresh" },
  { href: "/(main)/(demos)/screen-pricing", icon: "credit-card", label: "Pricing", description: "Plans & comparison" },
  { href: "/(main)/(demos)/screen-welcome", icon: "log-in", label: "Welcome", description: "Landing & social login" },
  { href: "/(main)/(demos)/screen-card-grid", icon: "grid", label: "Card Grid", description: "Filterable card layout" },
  { href: "/(main)/(demos)/screen-chat", icon: "message-circle", label: "Chat", description: "Messaging conversation" },
  { href: "/(main)/(demos)/screen-dashboard", icon: "bar-chart-2", label: "Dashboard", description: "Metrics & quick actions" },
  { href: "/(main)/(demos)/screen-form", icon: "edit-3", label: "Form", description: "Multi-step wizard" },
  { href: "/(main)/(demos)/screen-notifications", icon: "bell", label: "Notifications", description: "Grouped notification list" },
  { href: "/(main)/(demos)/screen-search", icon: "search", label: "Search", description: "Filtered search results" },
  { href: "/(main)/(demos)/screen-error", icon: "alert-triangle", label: "Error", description: "Error state variants" },
  { href: "/(main)/(demos)/detail-hero", icon: "layout", label: "Detail / Hero", description: "Hero image detail view" },
];
```

Move `detail-hero` from the `demos` array to `screenTemplates` since it is a screen template.

### 9. Register new routes in main layout

**File:** `app/(main)/_layout.tsx`

Add `Stack.Screen` entries for each new demo route:

```tsx
<Stack.Screen name="(demos)/screen-card-grid" options={{ title: "Card Grid Screen", ...webHeaderLeft }} />
<Stack.Screen name="(demos)/screen-chat" options={{ title: "Chat Screen", ...webHeaderLeft }} />
<Stack.Screen name="(demos)/screen-dashboard" options={{ title: "Dashboard Screen", ...webHeaderLeft }} />
<Stack.Screen name="(demos)/screen-form" options={{ title: "Form Screen", ...webHeaderLeft }} />
<Stack.Screen name="(demos)/screen-notifications" options={{ title: "Notifications Screen", ...webHeaderLeft }} />
<Stack.Screen name="(demos)/screen-search" options={{ title: "Search Results Screen", ...webHeaderLeft }} />
<Stack.Screen name="(demos)/screen-error" options={{ title: "Error Screen", ...webHeaderLeft }} />
```

### 10. Update badge count

**File:** `app/(main)/(tabs)/index.tsx`

The component count badge should also be updated if the component showcase spec runs concurrently. If not, leave it as-is (the showcase spec handles the badge).

## Acceptance Criteria

1. All 7 new demo route files exist in `app/(main)/(demos)/` and render their respective screen templates with realistic sample data.
2. Every demo is navigable from the Explore tab's screen templates grid.
3. DetailHero is moved from the "Demos & Tools" list to the "Screen Templates" grid.
4. All new routes are registered in `app/(main)/_layout.tsx` with proper titles and web back buttons.
5. Each demo is self-contained with local state -- no external API calls or dependencies beyond the screen template itself.
6. The Chat demo supports sending new messages (appended to local state).
7. The Form demo validates fields and shows error states.
8. The Error demo allows switching between all 5 error variants.
9. TypeScript compiles with no new errors.
10. Web and native both render the new demos correctly.

## Constraints

- Follow the exact pattern established by `screen-list.tsx` and `screen-settings.tsx`: import the screen template, create sample data, render with props.
- Each demo file should be a single default-exported component with local state.
- Use realistic sample data -- not placeholder text. Names, values, and descriptions should feel like a real app.
- The Form demo requires `react-hook-form` (already a project dependency via FormScreen). Use `useForm()` in the demo file.
- Do not modify the screen template implementations in `client/screens/`. This spec only creates demo routes.

## Out of Scope

- Modifying screen template APIs or adding new features to existing templates.
- Adding tests for demo routes (these are demo pages).
- Responsive layout changes to the Explore tab grid (if 13 items look crowded, that is a separate UI task).
- Deep linking / URL patterns for the new demo routes.

## Files Likely Affected

**New files:**
- `app/(main)/(demos)/screen-card-grid.tsx`
- `app/(main)/(demos)/screen-chat.tsx`
- `app/(main)/(demos)/screen-dashboard.tsx`
- `app/(main)/(demos)/screen-form.tsx`
- `app/(main)/(demos)/screen-notifications.tsx`
- `app/(main)/(demos)/screen-search.tsx`
- `app/(main)/(demos)/screen-error.tsx`

**Modified files:**
- `app/(main)/(tabs)/index.tsx` (update `screenTemplates` array, move detail-hero)
- `app/(main)/_layout.tsx` (add 7 new Stack.Screen entries)

## Edge Cases

- **FormScreen with react-hook-form:** The FormScreen expects a `UseFormReturn` object. The demo must create this with `useForm()` and pass it correctly. Ensure default values are set so the form renders without errors on mount.
- **ChatScreen scroll position:** New messages should auto-scroll to the bottom. The ChatScreen component handles this internally, but verify with the sample data.
- **ErrorScreen variants:** Each variant has different default icon/title/description. The demo should let users switch between them without navigation -- use local state, not separate routes.
- **CardGrid empty state:** If all filters are deselected, the CardGrid should show its empty state. Include this as a testable scenario.
- **NotificationList sections:** The SectionList in NotificationListScreen requires properly structured section data with `title` and `data` keys. Verify the sample data matches the expected interface.

## Risks

- **react-hook-form version compatibility:** FormScreen uses `UseFormReturn` from react-hook-form. Ensure the demo's `useForm()` usage is compatible with the installed version.
- **Large Explore tab grid:** Going from 5 to 13 screen templates in the grid may make the Explore tab feel crowded. The 2-column grid layout should handle it, but visual review is needed.
- **Chat component gesture conflicts:** ChatScreen uses keyboard avoiding view and scroll interactions. Test that it works correctly within the Stack navigation.
