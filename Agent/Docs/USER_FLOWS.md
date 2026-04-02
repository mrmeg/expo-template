# User Flows

<!-- Owned by: Human Advocate persona -->

These flows describe the template's built-in capabilities. They are not specific to any particular app built from the template.

## 1. App Startup

```
App process starts
  -> expo-splash-screen: preventAutoHideAsync() keeps splash visible
  -> Gesture handler initialized (client/lib/gesture-handler)
  -> Reactotron initialized (dev only, conditional require)
  -> validateClientEnv() — warns in dev, throws in prod for missing env vars
  -> setupSentry() — initializes Sentry if EXPO_PUBLIC_SENTRY_DSN is set; no-op otherwise
  -> useResources(): loads Lato fonts + Feather icons from local assets
     -> 5-second timeout via Promise.race
     -> On timeout or error: logs warning, proceeds with system fallback fonts
  -> initI18n(): checks languageStore for saved preference
     -> Falls back to device locale detection via expo-localization
     -> Loads English translations (always bundled)
     -> Lazy-loads non-English locale if needed (e.g., Spanish)
     -> Configures RTL via I18nManager if applicable
  -> Both fontsLoaded AND i18nReady must be true
  -> SplashScreen.hideAsync() — splash dismissed
  -> Provider tree renders:
     QueryClientProvider
       -> SafeAreaProvider
            -> ThemeProvider (applies navigation theme based on themeStore)
                 -> KeyboardProvider
                      -> ErrorBoundary (wraps Stack navigator)
                      -> StatusBar
       -> Notification (global toast, sibling to SafeAreaProvider)
       -> PortalHost (for portaled overlays like dialogs, popovers)
  -> Onboarding check: if !hasSeenOnboarding -> show OnboardingFlow
  -> Main tab navigator renders
```

**Key points:**
- The app renders nothing (`return null`) until fonts and i18n are both ready.
- Splash screen covers the blank period so the user never sees a white flash.
- Sentry and env validation run at module scope, before any component renders.

## 2. Onboarding

```
First launch (hasSeenOnboarding === false in onboardingStore)
  -> OnboardingFlow component renders
  -> Horizontal FlatList carousel with paging enabled
  -> Each page: icon (accent-colored) + title + description
  -> Dot indicators animate width (8px inactive, 24px active)
  -> Navigation options:
     a) "Skip" button (top right, hidden on last page)
        -> Calls onSkip or falls through to onComplete
     b) "Next" button (bottom, full width)
        -> Scrolls to next page
     c) "Get Started" button (replaces "Next" on last page)
        -> Calls onComplete
  -> onComplete handler:
     -> onboardingStore.setHasSeenOnboarding(true)
     -> Persisted to AsyncStorage (native) or localStorage (web)
  -> Subsequent launches: onboardingStore loads saved state at store creation
     -> hasSeenOnboarding === true -> skip directly to main screen
```

**Customization:** Pages are passed as props (`OnboardingPage[]` with icon, title, description). The template consumer defines the content; the component handles the carousel mechanics.

**Storage pattern:** `Platform.OS !== "web"` uses AsyncStorage; web uses `window.localStorage`. Both are synchronous reads at store creation time.

## 3. Authentication

### Sign In

```
User on auth screen -> enters email + password
  -> useAuth().signIn({ email, password })
  -> initAuth() ensures Amplify is configured + Hub listener attached (once)
  -> signIn() via aws-amplify/auth
  -> On success (result.isSignedIn):
     -> authStore.initialize() called
     -> getCurrentUser() fetches user profile from Cognito
     -> authStore state -> "authenticated", user object populated
  -> Hub listener also fires "signedIn" event
     -> 500ms delay, then checks if already authenticated to avoid duplicate init
     -> Throttle: minimum 2 seconds between initialize() calls
  -> UI reacts to authStore.state === "authenticated"
```

### Sign Up

```
User on sign-up form -> enters email + password
  -> useAuth().signUp({ email, password })
  -> Amplify signUp() with autoSignIn: true option
  -> On incomplete signup (!result.isSignUpComplete):
     -> authStore.pendingVerificationEmail set
     -> UI navigates to verification code screen
  -> User receives email with 6-digit verification code
  -> useAuth().confirmSignUp({ email, code })
     -> Amplify confirmSignUp()
     -> On completion: attempts autoSignIn()
     -> If auto sign-in succeeds: authStore.initialize() -> authenticated
     -> If auto sign-in fails: user directed to manual sign-in
```

### Forgot Password

```
User taps "Forgot Password"
  -> useAuth().forgotPassword(email)
  -> Amplify resetPassword() sends code to email
  -> User enters code + new password
  -> useAuth().resetPassword({ email, code, newPassword })
  -> Amplify confirmResetPassword()
  -> On success: user directed to sign-in screen
```

### Sign Out

```
User taps sign out
  -> authStore.signOut()
  -> Amplify signOut() clears session
  -> authStore: user -> null, state -> "unauthenticated"
  -> Hub fires "signedOut" event as confirmation
  -> UI reacts to unauthenticated state
```

### Hub Listener Events

The Hub listener (initialized once via `initAuth()`) handles:
- `signedIn` / `signInWithRedirect` -> re-initialize auth state
- `signedOut` -> clear user
- `tokenRefresh` -> logged (no action needed)
- `tokenRefresh_failure` -> set error "Session expired"
- `signInWithRedirect_failure` -> set error "Sign in failed"
- `confirmSignUp` with `COMPLETE_AUTO_SIGN_IN` -> trigger auto sign-in

## 4. Media Management

### Upload

```
User initiates media pick (expo-image-picker)
  -> Select image/video from library
  -> Optional: compress via imageCompression lib (settings from compressionStore)
  -> useMediaUpload().mutateAsync({ file, contentType, mediaType })
  -> POST /api/media/getUploadUrl with extension + mediaType
     -> Server generates presigned R2/S3 URL
     -> Returns { uploadUrl, key, expiresAt }
  -> Direct upload to R2/S3:
     a) Native: expo-file-system File class + expo/fetch for streaming upload
        (file never fully loaded into memory)
     b) Web: standard fetch with Blob body
  -> PUT to presigned URL with Content-Type header
  -> Returns { key } for storage reference
```

### View

```
Component needs to display media
  -> useSignedUrls({ mediaKeys, path })
  -> POST /api/media/getSignedUrls with keys array
  -> Server generates time-limited signed URLs
  -> Query cached by React Query (staleTime: 5min)
  -> URLs used in Image/Video components
  -> Note: signed URLs have limited validity; React Query cache handles refresh
```

### List

```
useMediaList({ prefix, limit, cursor })
  -> GET /api/media/list?prefix=...&limit=...&cursor=...
  -> Returns { items: [{ key, size, lastModified }], totalCount, nextCursor }
  -> Supports pagination via cursor
  -> Query key: ["media-list", prefix, limit, cursor]
```

### Delete

```
Single delete:
  -> useMediaDelete().mutateAsync(key)
  -> DELETE /api/media/delete?key=...
  -> On success: invalidates ["media-list"] queries

Batch delete:
  -> useMediaDeleteBatch().mutateAsync(keys)
  -> POST /api/media/delete with { keys: [...] }
  -> On success: invalidates ["media-list"] queries
  -> Returns { deleted: [...], errors: [...] }
```

## 5. Theme Selection

```
User opens settings -> Theme picker (system / light / dark)
  -> themeStore.setTheme("light" | "dark" | "system")
  -> Persisted immediately:
     a) Native: AsyncStorage.setItem("user-theme-preference", theme)
     b) Web: localStorage.setItem("user-theme-preference", theme)
  -> useTheme() hook reads themeStore.userTheme
     -> "system": resolves via useColorScheme() (OS preference)
     -> "light" / "dark": used directly
  -> Returns resolved scheme + theme object (colors, shadows, contrast helpers)
  -> ThemeProvider in root layout receives updated navigation theme
  -> All components re-render with new colors
  -> StatusBar adapts to light/dark scheme

On next launch:
  -> themeStore.loadTheme() runs at store creation
  -> Reads persisted preference from storage
  -> Theme applied before first render (no flash)
```

## 6. Language Selection

```
User opens settings -> Language picker (en / es)
  -> setLanguage(languageCode) from client/features/i18n
  -> If locale bundle not loaded: dynamic import (e.g., translations/es)
     -> addResourceBundle() to i18n instance
  -> i18n.changeLanguage(languageCode)
  -> languageStore.setUserLanguage(languageCode) persists preference
     a) Native: AsyncStorage
     b) Web: localStorage
  -> All components using useTranslation() re-render with new strings
  -> RTL: configured at initialization based on detected locale
     -> I18nManager.forceRTL(true) for RTL locales
     -> Requires app restart to take effect on native

On next launch:
  -> initI18n() checks languageStore for saved preference
  -> Saved language takes priority over device locale detection
  -> Non-English bundles lazy-loaded only when needed
```

**Supported languages:** English (en, always bundled), Spanish (es, lazy-loaded). Add new locales by creating a translation file and adding the tag to `supportedTags`.

## 7. Component Discovery

```
User taps Explore tab (or equivalent showcase entry)
  -> Browse 35 UI components organized by category:
     Accordion, Alert, AnimatedView, Badge, BottomSheet, Button,
     Card, Checkbox, Collapsible, Dialog, DismissKeyboard, Drawer,
     DropdownMenu, EmptyState, ErrorBoundary, Icon, InputOTP,
     Label, MaxWidthContainer, Notification, Popover, Progress,
     RadioGroup, Select, Separator, Skeleton, Slider, StatusBar,
     StyledText, Switch, Tabs, TextInput, Toggle, ToggleGroup, Tooltip
  -> Browse 13 screen template demos:
     CardGridScreen, ChatScreen, DashboardScreen, DetailHeroScreen,
     ErrorScreen, FormScreen, ListScreen, NotificationListScreen,
     PricingScreen, ProfileScreen, SearchResultsScreen,
     SettingsScreen, WelcomeScreen
  -> Each showcase item demonstrates the component with live examples
  -> Developers can see props, variants, and behavior across themes
  -> Showcase routes live under app/(main)/showcase/
```

## 8. Error Handling

```
Runtime JavaScript error occurs anywhere in the component tree
  -> ErrorBoundary (wrapping Stack navigator in root layout) catches it
  -> getDerivedStateFromError captures the Error object
  -> componentDidCatch receives errorInfo with component stack

  -> Sentry reporting:
     -> Sentry.captureException(error, { contexts: { react: { componentStack } } })
     -> No-op if EXPO_PUBLIC_SENTRY_DSN is not configured
     -> Production: 20% trace sample rate
     -> Development: 100% trace sample rate + console.error output

  -> Fallback UI (ErrorScreen component):
     -> Red circle icon with "!" symbol
     -> "Something went wrong" title
     -> User-friendly description with support contact suggestion
     -> "Try Again" button -> calls resetError() to clear error state
        -> Component tree re-renders normally
     -> Dev mode: "Show Details" / "Hide Details" toggle
        -> Error message, stack trace, component stack in monospace font
        -> Scrollable container for long stack traces

  -> catchErrors config (from config.base.ts):
     -> "always": catch in all environments (current default)
     -> "dev": only catch in development
     -> "prod": only catch in production
     -> "never": errors bubble up (ErrorBoundary passes through)
```

**Error flow by environment:**

| Environment | Sentry | Console | Fallback UI |
|-------------|--------|---------|-------------|
| Development (DSN set) | Reports at 100% sampling | Full error + info logged | Shown with expandable details |
| Development (no DSN) | No-op | Full error + info logged | Shown with expandable details |
| Production (DSN set) | Reports at 20% sampling | Silent | Shown (details hidden) |
| Production (no DSN) | No-op | Silent | Shown (details hidden) |

## Accessibility Notes

- All interactive elements should be reachable via screen reader.
- Color is never the only indicator of state -- always pair with text or icon.
- Touch targets: minimum 44x44pt on native.
- `useReducedMotion()` hook available for respecting OS-level motion preferences.
- Onboarding carousel supports swipe and button navigation.
- Error messages include actionable recovery (retry button).
