# User Flows

> Key user journeys and accessibility notes.

## App Entry

```
Launch App
  → Splash screen (expo-splash-screen)
  → Load fonts & resources (useResources)
  → Initialize i18n (device locale detection)
  → Initialize auth (Amplify Hub listener)
  → Hide splash screen
  → Root layout renders
    → If onboarding not completed → Onboarding flow
    → Else → Main tabs (Explore)
```

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

```
First launch (onboardingStore.completed === false)
  → OnboardingFlow component
  → 3-page swipeable flow
  → Complete → onboardingStore.setCompleted(true)
  → Persisted — never shown again
  → Navigate to main tabs
```

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
