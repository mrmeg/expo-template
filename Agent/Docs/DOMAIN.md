# Domain Model

<!-- Owned by: Domain Expert persona -->

## Overview

This is a **template project** -- not a specific application. The domain entities defined here are demonstrative and exist to showcase the template's capabilities (authentication, media management, notifications, onboarding, i18n, configuration, and forms). Teams adopting this template will replace or extend these entities with their own business-specific models.

## Auth Entities

Source: `client/features/auth/stores/authStore.ts`, `client/features/auth/hooks/useAuth.ts`

### User

Represents an authenticated user from AWS Cognito.

```typescript
interface User {
  userId: string;      // Cognito user ID
  username: string;    // Cognito username
  email?: string;      // Optional email address
}
```

### AuthState

Tri-state authentication status, stored in `authStore` (Zustand, non-persisted).

```typescript
type AuthState = "loading" | "authenticated" | "unauthenticated";
```

### AuthStore

Full store interface with internal loop-prevention state:

| Field | Type | Description |
|-------|------|-------------|
| `state` | `AuthState` | Current auth status |
| `user` | `User \| null` | Authenticated user or null |
| `pendingVerificationEmail` | `string \| null` | Email awaiting signup confirmation |
| `error` | `string \| null` | Last auth error message |
| `isInitializing` | `boolean` | Prevents concurrent initialization |
| `lastInitializeTime` | `number` | Timestamp for 2-second throttle |

### Auth Actions (useAuth hook)

`signIn`, `signUp`, `confirmSignUp`, `forgotPassword`, `resetPassword`, `signOut` -- all backed by AWS Amplify and the Cognito user pool.

Auth tokens are auto-injected into API requests via `authenticatedFetch.ts` using `fetchAuthSession()`.

### Environment Variables

- `EXPO_PUBLIC_USER_POOL_ID` -- Cognito User Pool ID
- `EXPO_PUBLIC_USER_POOL_CLIENT_ID` -- Cognito App Client ID

## Media Entities

Source: `client/features/media/hooks/useMediaList.ts`, `client/features/media/hooks/useMediaLibrary.ts`, `shared/media.ts`

### MediaItem

An object stored in R2/S3 bucket, returned by the list API.

```typescript
interface MediaItem {
  key: string;           // Storage key (path in bucket)
  size: number;          // File size in bytes
  lastModified: string;  // ISO timestamp
}
```

### ListResponse

Paginated response from the media list endpoint.

```typescript
interface ListResponse {
  items: MediaItem[];
  totalCount: number;
  nextCursor?: string;   // Cursor for next page
}
```

### MediaType

Derived from the shared `MEDIA_PATHS` constant, defining the folder structure in R2/S3:

```typescript
const MEDIA_PATHS = {
  avatars: "users/avatars",    // User profile avatars
  videos: "videos",           // Video files
  thumbnails: "thumbnails",   // Auto-generated video thumbnails
  uploads: "uploads",         // General uploads (images, documents)
} as const;

type MediaType = "avatars" | "videos" | "thumbnails" | "uploads";
```

### ProcessedAsset

Extends `ImagePicker.ImagePickerAsset` (minus `base64`, `exif`, `cancelled`) with additional fields for upload processing:

```typescript
interface ProcessedAsset {
  id: string;                   // Crypto-generated unique ID
  uri: string;                  // Local file URI
  width: number;
  height: number;
  type?: "image" | "video";
  fileName?: string;
  fileSize?: number;
  blob?: Blob;                  // For web upload
  duration?: number;            // Video duration in seconds
  thumbnailUri?: string;        // Local thumbnail URI
  thumbnailBlob?: Blob;         // Thumbnail blob for web upload
}
```

### Media Utilities

- `isVideoKey(key)` -- checks extension against `[mp4, mov, webm, avi, mkv, m4v]`
- `isImageKey(key)` -- checks extension against `[jpg, jpeg, png, gif, webp, svg, heic]`
- `getVideoThumbnailKey(videoKey)` -- converts video path to thumbnail path
- `formatBytes(bytes)` -- human-readable file size string

## Notification Entities

Source: `client/state/globalUIStore.ts`, `client/components/ui/Notification.tsx`

### Alert

The transient notification state managed by `globalUIStore`. Displayed by the `Notification` component mounted at the root layout level.

```typescript
type Alert = {
  show: boolean;
  type: "error" | "success" | "info" | "warning";
  messages?: string[];         // Array of message lines
  title?: string;              // Optional notification title
  duration?: number;           // Auto-dismiss duration in ms
  loading?: boolean;           // Show loading spinner
  position?: "top" | "bottom"; // Display position
}
```

### globalUIStore Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `show` | `(alert: Omit<Alert, "show">) => void` | Display a notification |
| `hide` | `() => void` | Dismiss the current notification |

## Onboarding Entities

Source: `client/features/onboarding/OnboardingFlow.tsx`, `client/features/onboarding/onboardingStore.ts`

### OnboardingPage

Defines a single page in the onboarding flow:

```typescript
interface OnboardingPage {
  icon: IconName;        // Feather icon name
  title: string;         // Page heading
  description: string;   // Page body text
}
```

### OnboardingFlowProps

```typescript
interface OnboardingFlowProps {
  pages: OnboardingPage[];
  onComplete: () => void;       // Called when user finishes
  onSkip?: () => void;          // Called when user skips
  doneLabel?: string;           // Custom "Done" button text
  nextLabel?: string;           // Custom "Next" button text
  skipLabel?: string;           // Custom "Skip" button text
}
```

### OnboardingStore

Tracks completion state. Persisted to AsyncStorage/localStorage.

```typescript
interface OnboardingStore {
  hasCompletedOnboarding: boolean;
  // Actions
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}
```

## i18n Entities

Source: `client/features/i18n/index.ts`, `client/features/i18n/translations/`, `client/features/i18n/stores/languageStore.ts`

### TxKeyPath

Type-safe translation key paths generated recursively from the English translations object. Ensures compile-time safety for all translation references.

```typescript
type TxKeyPath = RecursiveKeyOf<Translations>;
// Examples: "common.ok", "auth.signIn", "errors.network"
```

### Supported Languages

| Code | Language | Bundle Strategy |
|------|----------|-----------------|
| `en` | English | Always bundled (fallback) |
| `es` | Spanish | Lazy-loaded on demand |

### languageStore

Persists user language preference. The store's `loadLanguage()` method restores saved preference on startup; `setUserLanguage(code)` persists new selections.

### RTL Support

`I18nManager.forceRTL(true)` is called early (before React renders) when the detected locale has `textDirection === "rtl"`.

## Config Entities

Source: `client/config/config.base.ts`, `client/config/config.dev.ts`, `client/config/config.prod.ts`, `client/config/index.ts`

### ConfigBaseProps

Environment-aware configuration interface. Base config is merged with dev or prod overrides at runtime based on `__DEV__`.

```typescript
interface ConfigBaseProps {
  persistNavigation: "always" | "dev" | "prod" | "never";
  catchErrors: "always" | "dev" | "prod" | "never";
  exitRoutes: string[];     // Routes where back exits the app (Android)
  apiUrl: string;           // Base URL for API requests
  apiTimeout: number;       // Request timeout in ms (default: 10000)
  sentryDsn: string;        // Sentry DSN (empty string disables)
}
```

### Default Values

| Field | Default |
|-------|---------|
| `persistNavigation` | `"dev"` |
| `catchErrors` | `"always"` |
| `exitRoutes` | `["index", "(main)"]` |
| `apiUrl` | `""` (empty) |
| `apiTimeout` | `10000` |
| `sentryDsn` | `process.env.EXPO_PUBLIC_SENTRY_DSN ?? ""` |

## Form System

Source: `client/screens/FormScreen.tsx`

### FormStep

Defines a single step in a multi-step form flow. Used by the `FormScreen` screen template.

```typescript
interface FormStep {
  title: string;                                    // Step heading
  description?: string;                             // Optional step description
  fields: string[];                                 // Field names for per-step validation with trigger()
  content: (form: UseFormReturn<any>) => ReactNode; // Render function receiving react-hook-form instance
}
```

### FormScreenProps

```typescript
interface FormScreenProps {
  steps: FormStep[];                                    // Array of form steps
  form: UseFormReturn<any>;                             // react-hook-form instance
  onSubmit: (data: any) => void | Promise<void>;        // Submit handler
  showReview?: boolean;                                 // Show review step before submit
  renderReview?: (data: any) => ReactNode;              // Custom review renderer
  submitLabel?: string;                                 // Custom submit button text
  header?: ReactNode;                                   // Optional header above form
  style?: StyleProp<ViewStyle>;                         // Container style override
}
```

### Validation

Form validation uses **zod** schemas integrated with `react-hook-form` via `@hookform/resolvers/zod`. The `FormStep.fields` array enables per-step validation by calling `form.trigger(step.fields)` before advancing to the next step.

## API Layer Entities

Source: `client/lib/api/apiClient.ts`, `client/lib/api/authenticatedFetch.ts`

### ApiResponse (Discriminated Union)

The `apiClient` returns typed discriminated unions for all requests:

```typescript
type ApiResponse<T> =
  | { kind: "ok"; data: T }
  | { kind: "timeout" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "server" }
  | { kind: "bad-request" }
  | { kind: "rejected" }
  | { kind: "unknown" };
```

### API Methods

`api.get<T>(path)`, `api.post<T>(path, body)`, `api.put<T>(path, body)`, `api.patch<T>(path, body)`, `api.delete<T>(path)` -- all return `Promise<ApiResponse<T>>`.

## State Management Patterns

All Zustand stores follow these conventions:

- **Feature stores** live in `client/features/<name>/stores/` and are only accessed by their owning feature or via barrel export
- **Shared stores** live in `client/state/` (themeStore, drawerStore, globalUIStore)
- **Persistence** uses `Platform.OS` checks: AsyncStorage for native, localStorage for web
- **No cross-feature imports** -- features only import from the shared layer (`client/lib/`, `client/components/`, `client/hooks/`, `client/state/`)
