# Spec: Notifications, Chat & Analytics Screen Templates

**Status:** Ready
**Priority:** Low
**Scope:** Client

---

## Summary

Add three new screen templates to `client/screens/`: `NotificationListScreen` for notification feeds with read/unread states and date grouping, `ChatScreen` for message-based interfaces with keyboard handling, and `DashboardScreen` for analytics/metrics overview layouts. All three use typed generics for data and follow the established template conventions.

---

## Motivation

Notifications, chat, and dashboards are among the most commonly needed screen patterns in mobile apps. The existing template library covers lists, profiles, settings, detail views, pricing, and welcome flows -- but has no patterns for real-time or data-dense interfaces. These three templates fill that gap.

---

## Deliverables

### A) NotificationListScreen (`client/screens/NotificationListScreen.tsx`)

A notification feed with read/unread states, date-grouped sections, and swipe-to-dismiss.

#### Props Interface

```typescript
export interface NotificationItem<T = Record<string, unknown>> {
  id: string;
  icon?: IconName;
  title: string;
  body?: string;
  timestamp: Date;
  read: boolean;
  data?: T;                                // arbitrary payload for consumer use
}

export interface NotificationListScreenProps<T = Record<string, unknown>> {
  notifications: NotificationItem<T>[];
  onNotificationPress?: (notification: NotificationItem<T>) => void;
  onArchive?: (notification: NotificationItem<T>) => void;
  onDelete?: (notification: NotificationItem<T>) => void;
  onMarkAllRead?: () => void;

  // States
  loading?: boolean;
  skeletonCount?: number;                  // defaults to 5

  // Empty state
  emptyIcon?: IconName;                    // defaults to "bell-off"
  emptyTitle?: string;                     // defaults to "All caught up!"
  emptyDescription?: string;               // defaults to "You have no new notifications."

  // Refresh
  onRefresh?: () => void;
  refreshing?: boolean;

  // Layout
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}
```

#### Behavior

- **Date section headers:** Notifications are grouped by date. Section headers render as uppercase 13px `mutedForeground` text with `letterSpacing: 0.8` (same style as SettingsScreen section titles). Grouping logic:
  - "Today" for current date
  - "Yesterday" for previous date
  - Full date string (e.g. "March 25") for older dates
  - The component handles grouping internally from the flat `notifications` array, sorted by timestamp descending.
- **Notification rows:** Each item is a `Pressable` row with:
  - Left: icon in a 36x36 circular container (`theme.colors.muted` background). If no icon provided, use `"bell"` as default.
  - Center: title (16px, `foreground`) + body (14px, `mutedForeground`, maxLines 2) + timestamp (12px, `mutedForeground`). Timestamp formatted as relative time: "2m ago", "1h ago", "3d ago".
  - Right (unread only): small 8px accent-colored dot indicator.
  - Unread items have `fontWeight: "600"` on title and slightly different background (`theme.colors.muted` at 50% opacity or `theme.colors.card`).
  - Read items use standard `foreground`/`mutedForeground` styling.
- **Swipe actions:** If `onArchive` or `onDelete` is provided, rows support swipe gestures. Implementation approach: wrap each row in a `View` with a `PanResponder` or use `Swipeable` from react-native-gesture-handler (prefer `Swipeable` if available in the project's gesture handler setup). Swipe left reveals an archive action (if `onArchive` provided). Swipe further or swipe right reveals a delete action (if `onDelete` provided). Archive uses `theme.colors.accent` background, delete uses `theme.colors.destructive` background. **Note:** If gesture handler `Swipeable` introduces complexity or cross-platform issues, the implementer may simplify to a long-press context menu or omit swipe -- this is an enhancement, not a blocker.
- **Mark all as read:** If `onMarkAllRead` is provided, render a small ghost button or pressable text in the header area ("Mark all as read" in 14px accent color).
- **SectionList:** Use `SectionList` instead of `FlatList` due to date grouping. Sections are computed from the flat notifications array.
- **Staggered entrance** on each notification row via `AnimatedView` with `fadeSlideUp`, capped at 10.
- **Loading skeleton:** Renders skeleton rows matching the notification row layout (circle + two text lines + small dot).
- **Empty state:** Centered, same pattern as ListScreen empty state.
- **Pull-to-refresh** via `RefreshControl`.
- **Relative timestamp helper:** Implement a small utility function inside the file (not exported) that converts a `Date` to a relative string. Keep it simple: <60s = "just now", <60m = "Xm ago", <24h = "Xh ago", <7d = "Xd ago", else formatted date.

#### Visual Layout

```
[header (optional)]
["Mark all as read" button (conditional)]
[SectionList with date headers and notification rows]
  [section header: "Today"]
    [notification row]
    [notification row]
  [section header: "Yesterday"]
    [notification row]
[OR empty state]
[OR skeleton loading]
```

### B) ChatScreen (`client/screens/ChatScreen.tsx`)

A message-based chat interface with keyboard handling and message grouping.

#### Props Interface

```typescript
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface ChatMessage<T = Record<string, unknown>> {
  id: string;
  text: string;
  timestamp: Date;
  isMine: boolean;
  status?: MessageStatus;                  // only shown on "isMine" messages
  data?: T;                                // arbitrary payload
}

export interface ChatScreenProps<T = Record<string, unknown>> {
  messages: ChatMessage<T>[];
  onSend: (text: string) => void;
  onMessagePress?: (message: ChatMessage<T>) => void;

  // Input
  placeholder?: string;                   // defaults to "Type a message..."
  maxInputLength?: number;

  // Typing indicator
  isTyping?: boolean;                      // shows typing indicator when true

  // States
  loading?: boolean;

  // Layout
  style?: StyleProp<ViewStyle>;
}
```

#### Behavior

- **Message bubbles:** Sent messages (`isMine: true`) aligned right with `theme.colors.primary` background and `theme.colors.primaryForeground` text. Received messages aligned left with `theme.colors.card` background (with border) and `theme.colors.foreground` text. Border radius: `spacing.radiusLg` on all corners, except the tail corner which uses a smaller radius (4px) -- bottom-right for sent, bottom-left for received.
- **Timestamp grouping:** Messages within 5 minutes of each other from the same sender are visually grouped (no repeated avatar/spacing). A timestamp label appears between groups: formatted as "HH:MM AM/PM" in 11px `mutedForeground`, centered.
- **Day separators:** When the date changes between messages, show a centered day label (e.g. "Today", "Yesterday", "March 25") in a small pill: `theme.colors.muted` background, `mutedForeground` text, 12px, border radius full.
- **Message status:** For `isMine` messages, show a small status indicator below the bubble (right-aligned). Use 11px `mutedForeground` text: "Sending..." for `sending`, a single check icon for `sent`, double check for `delivered`, double check in accent color for `read`. Use `Icon` component with size 12.
- **Input bar:** Fixed at the bottom. Contains a `TextInput` (from UI components) and a send `Pressable` (circular, `theme.colors.primary` background, arrow-up icon in `primaryForeground`). Send button is disabled (reduced opacity) when input is empty. The bar has a top border (`theme.colors.border`) and `theme.colors.background` background. Padding: `spacing.sm` all around.
- **Keyboard handling:** Use `KeyboardAvoidingView` from react-native with `behavior="padding"` on iOS and `behavior="height"` on Android (standard RN pattern). The input bar must stay visible above the keyboard. Import `Platform` for the behavior check.
- **Auto-scroll:** The `FlatList` is rendered inverted (`inverted={true}`) so newest messages appear at the bottom. Messages array should be passed as-is -- `FlatList` with `inverted` handles the visual ordering. When new messages arrive (array length changes), the list is already at the bottom due to inversion.
- **Typing indicator:** When `isTyping` is true, show a small bubble on the left (received-message style) containing three animated dots. The dots pulse in sequence using `Animated.loop` with staggered delays (0ms, 150ms, 300ms). Each dot is 6px diameter, `mutedForeground` color, with opacity animating between 0.3 and 1.0.
- **Loading state:** Shows a few skeleton message bubbles (alternating left/right alignment) instead of the message list.
- **FlatList:** Use `inverted` FlatList for the message list. `contentContainerStyle` sets padding. `showsVerticalScrollIndicator={false}`.
- **No pull-to-refresh** (inverted list makes this awkward; loading older messages is out of scope).

#### Visual Layout

```
[inverted FlatList of messages]
  [day separator]
  [received bubble]
  [received bubble]      (grouped, no extra spacing)
  [timestamp label]
  [sent bubble]
  [sent status]
  [typing indicator (conditional)]
[input bar: TextInput + send button]
```

### C) DashboardScreen (`client/screens/DashboardScreen.tsx`)

An analytics/metrics overview with metric cards, sections, and an activity feed.

#### Props Interface

```typescript
export type TrendDirection = "up" | "down" | "flat";

export interface MetricCard {
  label: string;
  value: string;
  trend?: TrendDirection;
  trendValue?: string;                     // e.g. "+12%", "-3%"
  icon?: IconName;
}

export interface DashboardSection {
  title: string;
  viewAllLabel?: string;                   // defaults to "View all"
  onViewAll?: () => void;
  content: ReactNode;
}

export interface ActivityItem {
  id: string;
  icon?: IconName;
  title: string;
  description?: string;
  timestamp: string;                       // pre-formatted string, e.g. "2h ago"
}

export interface DashboardDateRange {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

export interface DashboardScreenProps {
  title?: string;                          // optional screen title
  metrics?: MetricCard[];
  sections?: DashboardSection[];
  activityFeed?: ActivityItem[];
  activityTitle?: string;                  // defaults to "Recent Activity"
  onActivityPress?: (item: ActivityItem) => void;
  dateRange?: DashboardDateRange;

  // Chart placeholders
  chartSections?: { title: string; height?: number }[];  // renders empty card placeholders

  // States
  loading?: boolean;

  // Refresh
  onRefresh?: () => void;
  refreshing?: boolean;

  // Layout
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}
```

#### Behavior

- **Metric cards row:** Horizontal `ScrollView` with `showsHorizontalScrollIndicator={false}`. Each card is a `View` with `theme.colors.card` background, border, `radiusLg`, padding `spacing.md`, min-width 140. Contains:
  - Optional icon (top-left, 20px, `mutedForeground`).
  - Label (13px, `mutedForeground`).
  - Value (24px, `foreground`, bold, `letterSpacing: -0.3`).
  - Trend indicator: small row with arrow icon (trending-up/trending-down/minus) + trend value text. Up = accent color, down = destructive color, flat = mutedForeground. Icon size 14, text 12px.
  - Cards have `spacing.sm` gap between them.
  - Staggered entrance per card using `AnimatedView` with `fadeSlideUp`.
- **Date range selector:** If `dateRange` is provided, render a `ToggleGroup` (same pattern as PricingScreen period toggle) positioned below the metrics row. Uses `ToggleGroup` + `ToggleGroupItem` from UI components.
- **Sections:** Each section has a header row with title (18px, bold, `foreground`, `letterSpacing: -0.3`) on the left and "View all" pressable text (14px, `accent` color) on the right. Below the header is the consumer-provided `content` ReactNode. Sections have `marginBottom: spacing.xl`. Staggered entrance per section.
- **Chart placeholders:** If `chartSections` is provided, render each as a `View` with `theme.colors.card` background, border, `radiusLg`, specified height (default 200), with a centered `SansSerifText` "Chart" in `mutedForeground`. This is a placeholder -- actual chart integration is out of scope.
- **Activity feed:** Rendered as a section at the bottom. Each item is a row:
  - Left: icon in 32x32 circular container (`theme.colors.muted` background, icon in `primary` color).
  - Center: title (15px, `foreground`) + description (13px, `mutedForeground`).
  - Right: timestamp (12px, `mutedForeground`).
  - Items separated by hairline dividers (same pattern as SettingsScreen/ProfileScreen).
  - If `onActivityPress` is provided, rows are wrapped in `Pressable`.
  - Activity items use staggered entrance.
- **Loading state:** Skeleton metric cards (horizontal row of 3 skeleton rectangles) + skeleton sections (title bar + large rectangle) + skeleton activity items (icon circle + text lines).
- **Pull-to-refresh** via `RefreshControl` on the main `ScrollView`.
- **Overall layout:** Single `ScrollView` wrapping all sections vertically.

#### Visual Layout

```
[header (optional)]
[screen title (optional)]
[metric cards horizontal scroll]
[date range toggle (conditional)]
[chart placeholder sections (conditional)]
[custom sections with "View all" headers]
[activity feed section]
```

---

## Patterns to Follow

These patterns are mandatory -- they come directly from the existing screen templates:

1. **File structure:** Types section, Component section, Styles section -- separated by banner comments.
2. **Generics:** NotificationListScreen and ChatScreen use `<T>` generic on function and props. DashboardScreen does not need generics (its data types are defined inline).
3. **Theme:** `useTheme()` + `createStyles(theme)` pattern.
4. **Imports:** Use `type Theme` from colors, `spacing` from constants, text components from StyledText, `AnimatedView` for list stagger, `Button`/`Icon`/`Skeleton` from UI components.
5. **Animations:** `AnimatedView` with `fadeSlideUp` for staggered list items. Use `useStaggeredEntrance` for hero/header elements (like DashboardScreen metric row entrance). Import `STAGGER_DELAY` from `useStaggeredEntrance`.
6. **Style override:** `style?: StyleProp<ViewStyle>` applied as `[styles.container, styleOverride]`.
7. **Typography:** Follow design system -- bold for titles/values, regular for body/labels. Negative letterSpacing on 2xl+ sizes.
8. **Spacing:** Use `spacing.*` tokens exclusively.
9. **Platform:** Use `Platform.OS` checks where needed (keyboard behavior in ChatScreen).
10. **Dividers:** Use `StyleSheet.hairlineWidth` with `theme.colors.border` (same as SettingsScreen/ProfileScreen).
11. **ToggleGroup:** Import from `@/client/components/ui/ToggleGroup` for DashboardScreen date range (same as PricingScreen period toggle).

---

## Implementation Notes

### NotificationListScreen

- Use `SectionList` from react-native (not `FlatList`) since the data is grouped by date.
- The date grouping logic should be a pure function inside the file that takes the flat array and returns `SectionListData` format.
- Relative time formatting is a small helper function (not exported) -- keep it simple, no external date library.

### ChatScreen

- The inverted FlatList pattern means the data array is rendered bottom-to-top visually. Pass messages in chronological order; `inverted` handles the flip.
- `KeyboardAvoidingView` wraps the entire screen. The FlatList takes `flex: 1`, the input bar is fixed height below it.
- The typing indicator dots animation should use `Animated` from react-native (not reanimated) for simplicity, since it is a simple looping opacity animation (same approach as the Skeleton component).
- Message grouping logic (same sender within 5 minutes) should be computed inline or via a small helper function.

### DashboardScreen

- This is the most visually dense screen but structurally the simplest -- it is a ScrollView with sections, no FlatList complexity.
- Metric cards in a horizontal ScrollView should have `contentContainerStyle` with horizontal padding.
- Chart placeholders are intentionally minimal -- just a bordered box with centered text.

---

## Out of Scope

- Real push notification handling (consumer manages notification data).
- WebSocket/real-time message delivery for chat.
- Actual charting library integration for dashboard (placeholder only).
- Message editing, reactions, or media attachments in chat.
- Notification badge counts.
- Infinite scroll / pagination for any of the three screens.
- Swipe-to-dismiss in NotificationListScreen is an enhancement -- may be simplified or omitted if gesture handler integration proves difficult.

---

## Testing Plan

### NotificationListScreen

1. Renders with minimal props (empty notifications array).
2. Notifications are grouped by date with correct section headers.
3. Unread notifications show accent dot and bolder title.
4. "Mark all as read" button renders when `onMarkAllRead` is provided.
5. Relative timestamps display correctly (minutes, hours, days).
6. Empty state renders with correct defaults.
7. Loading skeleton renders when `loading` is true.
8. Notification press callback fires with correct item.

### ChatScreen

1. Renders with minimal props (empty messages, onSend handler).
2. Sent messages align right with primary color, received align left.
3. Send button is disabled when input is empty.
4. `onSend` callback fires with input text, input clears after send.
5. Day separators render between messages on different dates.
6. Typing indicator renders when `isTyping` is true.
7. Message status indicators render for isMine messages.
8. Loading skeleton renders when `loading` is true.

### DashboardScreen

1. Renders with minimal props (no data).
2. Metric cards render in horizontal scroll with correct values and trends.
3. Trend indicators show correct colors (accent for up, destructive for down).
4. Date range toggle renders when `dateRange` is provided.
5. Sections render with titles and "View all" links.
6. Chart placeholders render with correct height.
7. Activity feed renders with icons, text, and timestamps.
8. Loading skeleton renders when `loading` is true.
9. Pull-to-refresh works when `onRefresh` is provided.

---

## Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `client/screens/NotificationListScreen.tsx` |
| Create | `client/screens/ChatScreen.tsx` |
| Create | `client/screens/DashboardScreen.tsx` |

---

## Estimated Effort

Large -- three files totaling ~800-1000 lines. ChatScreen is the most complex due to keyboard handling, inverted list, message grouping, and the typing indicator animation. NotificationListScreen is medium (SectionList + date grouping). DashboardScreen is medium (lots of sections but structurally simple).

Recommended implementation order: DashboardScreen (simplest structure), NotificationListScreen (SectionList pattern), ChatScreen (most complex).
