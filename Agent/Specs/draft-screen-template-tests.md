# Spec: Screen Template Tests

**Status:** Draft
**Priority:** Medium
**Scope:** Client

---

## What

Add integration tests for the three most complex screen templates: FormScreen (multi-step form with validation), ChatScreen (message rendering, input handling, typing indicator), and DashboardScreen (metric cards, sections, activity feed, loading states). These are the highest-risk templates among the 13 in `client/screens/` and currently have 0 test coverage.

## Why

Screen templates are the primary deliverable of this template project -- they are what users copy and customize. Bugs in these templates (broken step navigation, lost input text, incorrect message ordering) would directly degrade the developer experience. FormScreen's multi-step validation logic and ChatScreen's inverted FlatList sorting are particularly easy to regress.

## Current State

- **13 screen templates** in `client/screens/`: ChatScreen, DashboardScreen, DetailHeroScreen, ErrorScreen, FormScreen, CardGridScreen, ListScreen, NotificationListScreen, PricingScreen, ProfileScreen, SearchResultsScreen, SettingsScreen, WelcomeScreen.
- **0 test files** exist for any screen template.
- **Test infrastructure** is set up with mocks for Reanimated, gesture-handler, expo-router, safe-area-context, and i18next in `test/setup.ts`.
- **FormScreen** (`client/screens/FormScreen.tsx`): Multi-step form accepting `steps: FormStep[]` and a `form: UseFormReturn<any>`. Uses `form.trigger(step.fields)` for per-step validation. Has step indicator, back/next navigation, optional review step, and submit handling. Uses `useStaggeredEntrance` for animations and `useSafeAreaInsets` for padding.
- **ChatScreen** (`client/screens/ChatScreen.tsx`): Inverted FlatList with message bubbles, day separators, timestamps, typing indicator, status indicators (sending/sent/delivered/read), loading skeleton, and a text input bar with send button. Sorts messages newest-first. Uses 5-minute threshold for timestamp grouping.
- **DashboardScreen** (`client/screens/DashboardScreen.tsx`): Horizontal-scrolling metric cards with trend indicators, custom sections with "view all" links, activity feed with icons/timestamps, date range toggle (ToggleGroup), chart section placeholders, loading skeleton, and pull-to-refresh. Uses `AnimatedView` for staggered entrance.

## Changes

### 1. FormScreen tests -- `client/screens/__tests__/FormScreen.test.tsx`

Render FormScreen with a controlled `useForm` instance and mock steps. Use `@testing-library/react-native` for rendering and interaction.

**Setup:** Create a test wrapper that provides the required mocks (safe-area-context). Define 3 test steps with mock content renderers and field names. Create a `useForm` instance with default values and validation rules.

**Rendering tests:**
- Renders the first step title and description
- Renders the step indicator with correct number of circles
- First step circle is styled as current (not completed)
- "Next" button is visible; "Back" button is not visible on step 1
- Custom `header` prop renders above the step indicator
- Custom `submitLabel` prop replaces "Submit" text on the last step

**Navigation tests:**
- Pressing "Next" after valid input advances to step 2
- Step 2 shows "Back" button; pressing it returns to step 1
- Step indicator updates: step 1 circle shows check icon (completed), step 2 is current
- Pressing "Next" on the last step (without review) calls `onSubmit` with form values
- Cannot advance past a step with invalid fields (trigger returns false, stays on same step)

**Multi-step validation tests:**
- Define steps where step 1 requires "name" (required), step 2 requires "email" (required + pattern)
- Pressing "Next" on step 1 with empty "name" field does not advance
- Filling "name" and pressing "Next" advances to step 2
- Pressing "Next" on step 2 with invalid email does not submit

**Review step tests:**
- With `showReview={true}` and `renderReview` provided, advancing past the last form step shows the review screen
- Review screen displays "Review" as the title
- `renderReview` receives form values and renders its content
- Pressing submit on the review step calls `onSubmit`

**Submit behavior:**
- `onSubmit` is called with the complete form data object
- While submitting (async onSubmit), the submit button shows loading state and navigation is disabled
- After submit completes, `isSubmitting` resets to false

### 2. ChatScreen tests -- `client/screens/__tests__/ChatScreen.test.tsx`

Render ChatScreen with mock messages and an `onSend` callback.

**Setup:** Create a set of mock `ChatMessage` objects with known ids, timestamps, text, and isMine values. Mock `useSafeAreaInsets` to return `{ top: 44, bottom: 34, left: 0, right: 0 }`. Mock the `KeyboardAvoidingView` from `client/features/keyboard` to render a plain View.

**Rendering tests:**
- Renders message text for both sent and received messages
- Sent messages have accessibility label starting with "You:"
- Received messages have accessibility label starting with "Received:"
- Renders the text input with the placeholder text
- Send button is present with accessibility label "Send message"
- Custom `placeholder` prop text appears in the input

**Message ordering tests:**
- Messages are sorted newest-first (inverted FlatList) -- the first rendered item is the most recent message
- Messages from different days show day separator labels ("Today", "Yesterday", or formatted date)
- Messages from the same sender within 5 minutes do NOT show a timestamp separator
- Messages from the same sender with more than 5 minutes gap show a timestamp separator
- Messages from different senders always show a timestamp separator

**Input and send tests:**
- Typing text into the input updates the displayed value
- Send button is disabled (muted background) when input is empty
- Send button is enabled (primary background) when input has text
- Pressing the send button calls `onSend` with trimmed text
- After sending, the input is cleared to empty string
- Whitespace-only input does not trigger `onSend`
- `maxInputLength` prop limits the input character count

**Typing indicator tests:**
- When `isTyping={false}`, no typing indicator dots are rendered
- When `isTyping={true}`, the typing indicator appears (3 dots in a bubble)

**Status indicator tests:**
- Message with `status: "sending"` shows "Sending..." text
- Message with `status: "sent"` shows a single check icon
- Message with `status: "delivered"` shows double check icons
- Message with `status: "read"` shows double check icons in accent color
- Received messages (isMine: false) do not show status indicators

**Loading state tests:**
- When `loading={true}`, renders skeleton placeholders instead of messages
- Skeleton has 6 rows alternating alignment

**Interaction tests:**
- When `onMessagePress` is provided, pressing a message bubble calls it with the message object
- When `onMessagePress` is not provided, pressing a message bubble does nothing (no crash)

### 3. DashboardScreen tests -- `client/screens/__tests__/DashboardScreen.test.tsx`

Render DashboardScreen with mock metrics, sections, and activity items.

**Setup:** Create mock `MetricCard[]`, `DashboardSection[]`, and `ActivityItem[]` arrays. Mock safe-area-context.

**Rendering tests:**
- Renders the title when provided
- Does not render title area when title is omitted
- Renders metric cards with label, value, and trend value text
- Metric card with `trend: "up"` shows the trending-up icon
- Metric card with `trend: "down"` shows the trending-down icon
- Renders section titles
- Renders section content (passed as ReactNode)
- "View all" link appears when `viewAllLabel` and `onViewAll` are provided
- Renders activity items with title, description, and timestamp

**Metric cards tests:**
- All provided metrics render (test with 3 metrics, verify all 3 labels present)
- Metric with `icon` prop renders the icon
- Metric without `icon` prop does not render an icon in that card

**Sections tests:**
- Multiple sections render in order
- Pressing "View all" calls the section's `onViewAll` callback
- Section without `viewAllLabel` does not render the link

**Activity feed tests:**
- Activity items render with icon, title, description, and timestamp
- When `onActivityPress` is provided, pressing an activity row calls it with the activity item
- Dividers appear between activity items but not after the last one

**Date range toggle tests:**
- When `dateRange` prop is provided, toggle group renders with options
- Selecting a toggle option calls `dateRange.onSelect` with the value
- The currently selected option is highlighted

**Loading state tests:**
- When `loading={true}`, skeleton metric cards render instead of real metrics
- Skeleton sections render instead of real sections
- Skeleton activity rows render instead of real activity

**Chart sections tests:**
- When `chartSections` is provided, chart placeholders render with correct height
- Chart section with `title` shows the title text
- Default chart height is 180 when `height` is not specified

**Refresh tests:**
- When `onRefresh` is provided, the ScrollView has a RefreshControl
- When `onRefresh` is not provided, no RefreshControl is attached

**Header tests:**
- Custom `header` ReactNode renders at the top of the scroll content

## Acceptance Criteria

1. Three test files exist and all tests pass: `FormScreen.test.tsx`, `ChatScreen.test.tsx`, `DashboardScreen.test.tsx`
2. No existing tests break
3. FormScreen tests cover: step rendering, forward/back navigation, per-step validation blocking, review step, and submit
4. ChatScreen tests cover: message rendering with correct order, input/send flow, typing indicator, status indicators, and loading skeleton
5. DashboardScreen tests cover: metrics rendering, sections with view-all, activity feed with press handling, loading skeleton, and date range toggle
6. All tests run in under 20 seconds total
7. `npx expo lint` passes with no new warnings

## Constraints

- Do NOT modify any screen template source code -- this spec is tests-only
- Do NOT add new dependencies -- use jest, @testing-library/react-native, and the existing mock infrastructure
- Mock `useSafeAreaInsets` per test file to return consistent insets (not global mock)
- Mock `KeyboardAvoidingView` from `client/features/keyboard` as a plain View passthrough for ChatScreen
- The Reanimated mock in test/setup.ts already handles `AnimatedView` and `useStaggeredEntrance` -- do not add additional Reanimated mocks
- For FormScreen tests, use a real `useForm` from react-hook-form (already installed) with simple validation rules -- do not mock react-hook-form
- Do NOT test animation timing or visual appearance -- focus on rendered content, user interaction, and state transitions

## Out of Scope

- Tests for the other 10 screen templates (ListScreen, ProfileScreen, SettingsScreen, etc.)
- Visual regression testing or screenshot comparisons
- Performance testing (render counts, FlatList optimization)
- Tests for screen templates used within Expo Router layouts
- Accessibility audits beyond basic label verification
- Tests for the Skeleton component itself (it is a dependency, not the subject)

## Files Likely Affected

**Client (new test files only):**
- `client/screens/__tests__/FormScreen.test.tsx`
- `client/screens/__tests__/ChatScreen.test.tsx`
- `client/screens/__tests__/DashboardScreen.test.tsx`

## Edge Cases

- FormScreen with 1 step (no back button, next immediately submits)
- FormScreen with `showReview={true}` but no `renderReview` function -- review step should render nothing for content
- ChatScreen with 0 messages -- should render empty list with input bar
- ChatScreen with messages all on the same day -- day separator appears once at the top
- ChatScreen message with very long text -- bubble should respect maxWidth constraint
- DashboardScreen with empty metrics array -- no metric row rendered
- DashboardScreen with empty sections array -- no sections container rendered
- DashboardScreen with empty activityFeed array -- no activity container rendered
- DashboardScreen activity feed with 1 item -- no divider rendered
- FormScreen async `onSubmit` that throws -- `isSubmitting` should reset to false (finally block)

## Risks

- **FlatList rendering in tests:** React Native's FlatList may not render all items in a test environment due to virtualization. Use `initialNumToRender` awareness or test with small datasets (under 10 messages) to ensure all items are in the render tree. If FlatList windowing causes missing items, consider using `getByText` with `waitFor` or passing enough items for the initial render window.
- **Inverted FlatList order:** The ChatScreen sorts messages newest-first and uses `inverted` prop. Tests need to account for the visual order being reverse of the data array order.
- **KeyboardAvoidingView mock:** ChatScreen wraps content in `KeyboardAvoidingView` from `client/features/keyboard`. This must be mocked or it will fail to render. A simple View passthrough is sufficient.
- **ToggleGroup in DashboardScreen:** The ToggleGroup/ToggleGroupItem components from `@rn-primitives` may need mocking if they have native dependencies. If they render as standard RN components, they should work with the existing mock setup.
- **Safe-area-context mock:** `useSafeAreaInsets` is used in FormScreen and ChatScreen. It should be mocked per-file with `jest.mock("react-native-safe-area-context", ...)` returning consistent inset values.
