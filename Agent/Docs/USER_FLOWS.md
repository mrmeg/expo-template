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
| `(main)/(tabs)/settings.tsx` | **Protected** (`AuthGate`) |
| `(main)/showcase/**` | Public |
| `(main)/(demos)/**` (including `auth-demo`, `onboarding`) | Public |

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
Media tab → Pick image/video
  → useMediaLibrary hook (expo-image-picker)
  → If image:
      → Compress (HEIC → JPEG if needed)
      → Apply compression settings from compressionStore
  → If video:
      → Generate thumbnail (expo-video-thumbnails)
  → POST /api/media/getUploadUrl
  → PUT to presigned S3 URL
  → Toast notification (globalUIStore) on success/failure
  → Refresh media list
```

## Media Browse

```
Media tab → Load media list
  → GET /api/media/list (paginated)
  → POST /api/media/getSignedUrls (batch signed URLs)
  → Display grid/list of media items
  → Tap item → Detail view
    → If video → VideoPlayer component
  → Long press → Delete option
    → DELETE /api/media/delete
    → Refresh list
```

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
Explore tab → "UI Components" card
  → Navigate to showcase/index
  → Browse 35 components with live demos

Explore tab → Screen template cards
  → Navigate to any of 17 screen templates
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
