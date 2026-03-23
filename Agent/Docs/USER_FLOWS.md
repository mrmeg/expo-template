# User Flows

> Key user journeys and accessibility notes.

---

## App Startup

```
Launch app
  → preventAutoHideAsync() (hold splash screen)
  → Load fonts (Lato 400, 700 + Feather icons)
  → Initialize i18n (detect locale, load translations)
  → Initialize Reactotron (dev only)
  → Hydrate stores (theme, auth, language, onboarding)
  → Hide splash screen
  → Render root layout with providers
  → Check auth state
      ├── authenticated → show main app
      └── unauthenticated → show main app (auth guard per screen)
```

## Authentication

### Sign Up
```
User taps "Sign Up" on AuthScreen
  → Fills name, email, password, confirm password
  → Client validates password match
  → signUp() → Cognito creates user
  → Redirect to Verify Email form
  → User enters verification code from email
  → confirmSignUp() → Cognito verifies
  → Auto sign-in on success
  → Hub listener catches "signedIn" → authStore updates
  → App shows authenticated state
```

### Sign In
```
User enters email + password
  → signIn() → Cognito authenticates
  → Hub listener catches "signedIn"
  → authStore → "authenticated"
  → Tokens stored by Amplify (auto-refresh enabled)
```

### Forgot Password
```
User taps "Forgot Password"
  → Enters email
  → forgotPassword() → Cognito sends reset code
  → Success message shown
  → User enters code + new password
  → resetPassword() → Cognito updates password
  → Auto sign-in on success
```

### Sign Out
```
User taps "Sign Out" on Profile tab
  → Confirmation alert shown
  → signOut() → Amplify clears tokens
  → Hub listener catches "signedOut"
  → authStore → "unauthenticated"
```

## Media Management

### Upload Image
```
User taps upload on Media tab
  → Image picker opens (useMediaLibrary)
  → User selects image
  → EXIF data extracted (GPS, date taken)
  → If HEIC → convert to JPEG
  → Apply compression preset (from compressionStore)
  → POST /api/media/getUploadUrl
  → PUT file to presigned R2/S3 URL
  → Invalidate media-list query
  → New file appears in list
  → Toast notification: "Upload complete"
```

### Upload Video
```
User selects video from picker
  → Extract video thumbnail
  → Upload thumbnail to thumbnails/ path
  → POST /api/media/getUploadUrl (for video)
  → PUT video to presigned URL
  → Both video and thumbnail appear in list
```

### View Media
```
User opens Media tab
  → useMediaList() fetches list from API
  → FlatList renders items with thumbnails
  → User can filter by type (all, avatars, videos, uploads)
  → Stats card shows file count and total size
  → Tap video → modal player opens (VideoPlayer)
  → Images displayed via signed URLs (24h cache)
```

### Delete Media
```
User taps delete icon on media item
  → Confirmation alert shown
  → DELETE /api/media/delete?key=...
  → Invalidate media-list query
  → Item removed from list
```

## Theme Switching

```
User opens Settings tab
  → Radio group: System / Light / Dark
  → Select option → themeStore.setTheme()
  → Store persists to AsyncStorage/localStorage
  → ThemeProvider re-renders with new scheme
  → All useTheme() consumers update
  → Status bar style updates
  → Tab bar colors update
```

## Language Switching

```
User opens Settings tab
  → Language dropdown: English / Espanol
  → Select language → i18next.changeLanguage()
  → languageStore persists preference
  → If new locale → lazy-load translations
  → All useTranslation() consumers re-render
  → RTL configured if applicable
```

## Onboarding

```
First launch (hasSeenOnboarding = false)
  → OnboardingFlow component shown
  → Horizontal paging carousel (swipe or buttons)
  → Each page: icon + title + description
  → Skip button available on all pages
  → "Done" on last page → onboardingStore.complete()
  → hasSeenOnboarding = true (persisted)
  → Never shown again
```

## Navigation (Web)

```
User navigates to demo screen (web)
  → WebBackButton appears in header (non-native only)
  → Chevron-left icon
  → Tap → check canGoBack()
      ├── Browser history available → router.back()
      └── No history (direct URL access) → navigate to /(main)/(tabs)
```

## Explore Hub

```
User opens app (Explore tab)
  → 3 sections displayed:
      1. UI Components → Showcase screen (all 27 components demoed)
      2. Screen Templates → 5 templates (settings, profile, list, pricing, welcome)
      3. Demos & Tools → Form validation, auth, developer tools, onboarding, detail hero
  → Tap any row → navigate to respective screen
```

---

## Accessibility Notes

1. **Reduced motion** — All animation hooks (`useScalePress`, `useStaggeredEntrance`, `Skeleton`) check `useReduceMotion()` and disable animations when the user has reduced motion enabled.

2. **Color contrast** — `getContrastingColor()` computes WCAG-compliant text colors for dynamic backgrounds. Used by Button for automatic text contrast.

3. **Notification live region** — The Notification component uses `accessibilityLiveRegion` so screen readers announce notifications.

4. **Label association** — `<Label>` uses `nativeID` for form element association. `onPress` focuses the associated input.

5. **Touch targets** — Toggle components have 8px `hitSlop` for larger touch targets.

6. **Text selection** — StyledText enables `userSelect: "auto"` so users can select and copy text.

7. **Keyboard handling** — `KeyboardProvider` ensures forms remain visible when keyboard opens (native only, using react-native-keyboard-controller).

<!-- NEEDS HUMAN REVIEW: No screen reader testing results documented. Consider testing VoiceOver (iOS), TalkBack (Android), and screen reader (web) for key flows. -->
