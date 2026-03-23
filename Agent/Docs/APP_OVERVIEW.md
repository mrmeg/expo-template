# App Overview

> High-level overview of the Expo template application.

---

## What This Is

A production-ready Expo template providing a complete starting point for cross-platform (iOS, Android, Web) applications. It includes authentication, media management, internationalization, theming, and a full design system — all wired together with proper state management and API patterns.

## Target Platforms

| Platform | Runtime | Notes |
|----------|---------|-------|
| iOS | React Native 0.83 (New Architecture) | Native build via `expo run:ios` |
| Android | React Native 0.83 (New Architecture) | Native build via `expo run:android` |
| Web | React Native Web 0.21 | Async routes, served by Express in production |

## What's Included

### Authentication (AWS Cognito)
Complete auth flow: sign up, email verification, sign in, forgot/reset password, sign out. Managed by Amplify with Hub listeners for event-driven state updates. Tokens auto-injected into API requests.

### Media Management (Cloudflare R2 / S3)
Full file lifecycle: upload (with compression + EXIF extraction), list (with pagination + filtering), download (via presigned URLs), delete (single + batch). Supports images and video with thumbnail generation.

### Design System (27 Components)
Shadcn-inspired, zinc-based palette with teal accent. Includes Button, TextInput, Card, Switch, Toggle, Checkbox, Badge, DropdownMenu, Accordion, Collapsible, Popover, Tooltip, BottomSheet, Skeleton, EmptyState, and more. All theme-aware with light/dark mode support.

### Internationalization (i18n)
English + Spanish out of the box. Type-safe translation keys. Lazy loading for non-English locales. RTL support. Device locale auto-detection.

### State Management
Zustand stores with cross-platform persistence (AsyncStorage on native, localStorage on web). React Query for server state with mutation/query cache integration.

### Screen Templates (6)
Pre-built screens ready to customize: Welcome, Profile, Settings, List, Pricing, Detail/Hero.

### Developer Tools
Component showcase, form validation demo, auth flow demo, onboarding demo, developer tools screen. Reactotron integration for dev builds.

## Architecture at a Glance

```
Expo Router (file-based routing)
  ↓
Feature folders (self-contained, portable)
  ↓
Shared layer (components, hooks, lib, constants)
  ↓
Zustand (client state) + React Query (server state)
  ↓
API routes (serverless) + Express (production web)
  ↓
Cloudflare R2 / AWS Cognito (external services)
```

## Quick Start

```bash
bun install                     # Install dependencies
npx expo start                  # Start dev server
# Press i (iOS), a (Android), w (Web)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_USER_POOL_ID` | For auth | Cognito User Pool ID |
| `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | For auth | Cognito App Client ID |
| `R2_ACCOUNT_ID` | For media | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | For media | S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | For media | S3-compatible secret key |
| `R2_BUCKET_NAME` | For media | R2 bucket name |

## Key Files to Know

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root layout, provider nesting |
| `app/(main)/(tabs)/_layout.tsx` | Tab navigator config |
| `client/constants/colors.ts` | Color palette + themes |
| `client/hooks/useTheme.ts` | Theme hook (colors, shadows, contrast) |
| `client/lib/api/apiClient.ts` | Typed API client |
| `client/features/auth/` | Complete auth system |
| `client/features/media/` | Media management system |
| `client/components/ui/` | 27 design system components |
| `shared/media.ts` | Client/server shared constants |
| `scripts/generate.ts` | Component/screen scaffolding |
