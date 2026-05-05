# User Flows

> Key user journeys and accessibility notes.

## App Entry

The root layout (`app/_layout.tsx`) delegates readiness to
`useAppStartup` (`client/features/app/useAppStartup.ts`). The splash stays
visible until **all** of the following resolve:

1. Fonts and resources (`useResources`)
2. i18n initialization (device locale detection)
3. Onboarding state has been loaded from persistence
4. If auth is configured (see below): the Amplify Hub listener is registered
   and the initial auth state has resolved out of `loading`

```
Launch App
  → Splash screen (expo-splash-screen)
  → useAppStartup resolves (fonts, i18n, onboarding, auth bootstrap)
  → Hide splash screen
  → Root layout renders
    → If hasSeenOnboarding === false → <OnboardingGate /> (first-run)
        → On complete → setHasSeenOnboarding(true) → main Stack
    → Else → main Stack → (main) → (tabs)
```

### Auth Configuration (authEnabled)

`authEnabled` is determined by `isAuthEnabled()` in
`client/features/app/isAuthEnabled.ts`: true when both
`EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID` are set at
runtime. When false, the template is fully explorable without a Cognito
environment — `AuthGate` becomes a no-op and protected surfaces render
their children.

### Protected vs Public Surfaces

| Surface | Auth gate |
|---|---|
| `(main)/(tabs)/index.tsx` (Explore) | Public |
| `(main)/(tabs)/media.tsx` | Public |
| `(main)/(tabs)/profile.tsx` | **Protected** (`AuthGate`) |
| `(main)/(tabs)/settings.tsx` | Public |
| `(main)/(demos)/showcase/**` | Public |
| `(main)/(demos)/**` (including `auth-demo`, `onboarding`, all `screen-*` templates) | Public |

Protected screens wrap their exported default in `<AuthGate>` from
`client/features/app/AuthGate.tsx`. When auth is disabled the gate renders
its children. When auth is enabled and the user is not authenticated, the
gate renders the shared `AuthScreen` inline (no forced navigation), so
signing out from a protected tab simply replaces the tab's content with the
auth screen and leaves unprotected surfaces browsable.

### Post-Sign-In / Post-Sign-Out

- After sign-in completes inside a protected tab, the user lands back on
  that same tab (the `AuthGate` flips to rendering `children`).
- After sign-out, the user remains wherever they were; unprotected surfaces
  are still available, protected surfaces show `AuthScreen` again.
- Deep-link redirect preservation across a native cold-start is **not**
  implemented by this shell contract.

## Authentication

### Sign Up
```
AuthScreen → SignUpForm
  → Enter email + password
  → signUp() via Amplify
  → VerifyEmailForm (confirmation code)
  → confirmSignUp() via Amplify
  → authStore → authenticated
  → Navigate to main app
```

### Sign In
```
AuthScreen → SignInForm
  → Enter email + password
  → signIn() via Amplify
  → authStore → authenticated
  → Navigate to main app
```

### Forgot Password
```
SignInForm → "Forgot password?" link
  → ForgotPasswordForm (enter email)
  → forgotPassword() via Amplify
  → ResetPasswordForm (code + new password)
  → resetPassword() via Amplify
  → Navigate to sign in
```

### Sign Out
```
Settings tab → Sign Out button
  → signOut() via Amplify
  → authStore → unauthenticated
  → Navigate to auth screen
```

## Media Upload

```
Media tab → Pick up to configured selection limit (20 by default) images/videos
  → useMediaLibrary hook (expo-image-picker)
  → For each image:
      → Compress (HEIC → JPEG if needed)
      → Apply app defaults from mediaSettings through compressionStore
      → Keep source asset if the compressed output is not smaller
  → For each video:
      → Generate thumbnail (expo-video-thumbnails)
      → Convert unsupported web formats to MP4 only when the result is smaller
  → Sequentially upload each selected asset
      → POST /api/media/getUploadUrl with mediaType + contentType + optional size
      → PUT to presigned S3/R2 URL with the same Content-Type
      → If video thumbnail exists, upload it to thumbnails with the video basename
  → Toast notification (globalUIStore) on success/partial failure/failure
  → Refresh media list
```

## Media Browse

```
Media tab → Load media list
  → For a selected media type: GET /api/media/list?mediaType=<type> (paginated)
  → For All: run one configured media-type list per template media type and merge visible results
  → 503 media-disabled (no R2/S3 env vars):
      → Render setup-state in the Media tab (cloud-off icon, missing-vars list)
      → Disable the upload button
      → React Query does NOT retry — caller must reconfigure
  → 200 OK:
      → POST /api/media/getSignedUrls (batch signed URLs)
      → Display grid/list of media items
      → Tap image thumbnail → full-screen image preview
      → Tap video preview → VideoPlayer component
      → Select individual rows with checkboxes, or select all visible rows
      → Delete selected rows
        → POST /api/media/delete with selected keys
        → Include generated thumbnail keys for selected videos
      → Delete one row
        → DELETE /api/media/delete
        → Refresh list
  → Other error (network, 5xx):
      → Render retryable error state with the original message + Retry button
```

## Subscription Purchase (baseline, hosted-external)

The template's default billing flow is Stripe Checkout + Billing Portal
via `hosted-external` mode — see [`BILLING.md`](./BILLING.md) for the
full architecture.

### Purchase — Web

```
Pricing screen → tap "Choose plan" (unauthenticated users see "Sign in to continue")
  → useBillingActions.startCheckout({ planId, interval })
  → POST /api/billing/checkout-session { planId, interval, returnPath: "/billing/return" }
  → server returns { url } pointing at Stripe Checkout
  → window.location = url
  → user pays on Stripe
  → Stripe redirects to https://app.example.com/billing/return?status=success
  → /billing/return screen invalidates the billing summary query
  → useBillingSummary refetches → UI reflects the new plan
  → Stripe webhook (authoritative) flips server state to active/trialing
```

### Purchase — Native (iOS / Android)

```
Pricing screen → tap "Choose plan"
  → useBillingActions.startCheckout({ planId, interval })
  → POST /api/billing/checkout-session
  → server returns { url }
  → WebBrowser.openAuthSessionAsync(url, "myapp://billing/return")
  → user pays on Stripe in the system browser
  → redirect to myapp://billing/return?status=success
  → hook resolves, invalidates the billing summary query
  → /billing/return screen renders while summary refetches
  → webhook updates server-side state
```

### Manage (all platforms)

```
Profile tab → "Manage Subscription" (shown when customerId is set)
  → useBillingActions.startPortal()
  → POST /api/billing/portal-session { returnPath: "/billing/return" }
  → server returns Billing Portal { url }
  → Web: window.location = url
  → Native: WebBrowser.openAuthSessionAsync(url, "myapp://billing/return")
  → on return, the hook invalidates the billing summary query
```

### Pricing-screen CTA state machine

`derivePlanActionState` inside `@/client/features/billing` derives the
CTA for each card from the `BillingSummary`. Pricing screens must not
read summary fields directly.

| Summary state | Plan card | Derived state | CTA label (authenticated) |
|---------------|-----------|---------------|---------------------------|
| no summary / `free` | free | `upgrade` | `Choose plan` (free shortcut → "already on free plan") |
| no summary / `free` | paid | `upgrade` | `Choose plan` |
| `active` / `trialing` / `past_due` | same paid plan | `current` | `Current plan` (disabled) |
| `active` / `trialing` / `past_due` | other paid plan | `manage` | `Manage subscription` |
| `active` / `trialing` / `past_due` | free | `downgrade-disabled` | `Manage subscription` + "Cancel through Manage subscription" hint |

Environment-level overrides (billing disabled, plan missing prices)
flow through `disabledReason` and take precedence over the downgrade hint.

**Return URL contract:** `/billing/return` with `status=success|cancel|portal`.
The return page refetches `useBillingSummary` and routes the user back —
it does NOT treat the redirect as proof of payment. Webhooks own state.

**Entitlement:** a user is entitled when
`BillingSummary.state ∈ { trialing, active, past_due }`. Pricing and
account UIs must use the shared entitlement helper, not raw state
comparisons.

**Scope note:** native `PaymentSheet`, Apple / Google in-app purchase,
usage-based billing, tax, and team seats are **out of scope for the
baseline template**. Adopters shipping native apps that sell digital
goods consumed inside the app must confirm store policy before enabling
the hosted default on native builds.

## Theme Switching

```
Settings tab → Theme toggle
  → themeStore.setTheme(light|dark|system)
  → Persisted to AsyncStorage/localStorage
  → ThemeProvider re-renders with new colors
  → Web: html[data-theme] attribute updated
  → StatusBar color updates
```

## Language Switching

```
Settings tab → Language selector
  → languageStore.setLanguage(code)
  → Lazy-load translation bundle (if not English)
  → i18next updates active language
  → All translated strings re-render
  → RTL layout forced if applicable
```

## Onboarding

Owned by the shell, not the demo route. `app/_layout.tsx` renders
`<OnboardingGate />` (from `client/features/app/OnboardingGate.tsx`)
inline when `hasSeenOnboarding === false` — the main Stack never mounts
during first-run onboarding, so there is no flash into tabs.

```
First launch (onboardingStore.hasSeenOnboarding === false)
  → <OnboardingGate /> rendered by root layout
  → 3-page swipeable OnboardingFlow
  → Complete → setHasSeenOnboarding(true) (persisted)
  → Root layout re-renders the main Stack
```

The demo at `app/(main)/(demos)/onboarding.tsx` remains available for
showcase purposes and continues to use the same `OnboardingFlow` primitive.

## Tab Navigation

```
Bottom tabs (4 tabs):
  ├─ Explore (index) → Dashboard with links to demos/templates
  ├─ Media → Upload/browse media files
  ├─ Profile → User profile display
  └─ Settings → Theme, language, auth, developer tools

Active tab: accent (teal) tint
Inactive tab: mutedForeground
```

## Demo/Showcase Access

```
Explore tab → "Component Library" card
  → Navigate to (main)/(demos)/showcase/index
  → Browse the components listed in client/showcase/registry.ts (count derived via getComponentCount())

Explore tab → Screen template cards (driven by SCREEN_TEMPLATES in client/showcase/registry.ts)
  → Navigate to any of the 13 screen templates
  → (Settings, Profile, List, Pricing, Welcome, etc.)
```

## Error Handling

```
React error in any screen
  → ErrorBoundary catches
  → Sentry reports (if configured)
  → ErrorScreen fallback displayed
  → User can retry or navigate home

API error
  → apiClient returns discriminated union
  → Component handles specific error kind
  → Toast notification for user-facing errors
  → Auto-retry for transient failures (2 attempts)
```

## Accessibility Notes

- **SafeAreaProvider**: All content respects device safe areas (notch, home indicator)
- **KeyboardProvider**: Platform-aware keyboard avoidance
- **useReduceMotion**: Animations respect OS "reduce motion" setting
- **Color contrast**: `getContrastingColor()` ensures WCAG-compliant text on dynamic backgrounds
- **Tab bar**: Proper labels and icons for screen readers
- **StatusBar**: Adapts to theme for visibility
- **Touch targets**: Component sizes (sm=32, md=36, lg=40) meet minimum 32px touch target
