# App Overview

> High-level overview of the Expo Template application.

## What Is This?

A production-ready **Expo app template** for building cross-platform applications (iOS, Android, Web). It provides foundational infrastructure — authentication, media handling, theming, i18n, a design system, and screen templates — so concrete apps can be built on top without boilerplate setup.

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| iOS | Full support | New Architecture enabled, tablet support |
| Android | Full support | New Architecture enabled |
| Web | Full support | Express server for production, async routes |

## Core Capabilities

### Authentication
AWS Cognito via Amplify. Sign up, sign in, email verification, password reset. Token management is automatic.

### Media Management
Upload, browse, and delete images/videos stored in S3/R2. Client-side compression, HEIC conversion, video thumbnails. Presigned URLs for secure access.

### Design System
35 shadcn-inspired UI components built on @rn-primitives. Zinc-based color palette with teal accent. Full dark mode support. Consistent sizing and spacing tokens.

### Internationalization
English and Spanish with lazy-loaded translation bundles. RTL support. Device locale auto-detection.

### Screen Templates
17 pre-built screen templates: Settings, Profile, List, Pricing, Welcome, Card Grid, Chat, Dashboard, Multi-step Form, Notifications, Search Results, Error States, Detail Hero.

### Developer Tools
Component showcase, form validation demos, auth demos, Reactotron integration, developer settings screen.

## How to Use This Template

1. **Clone and install**: `bun install`
2. **Configure auth**: Set `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID`
3. **Configure storage**: Set S3/R2 credentials for media features
4. **Start building**: Add screens in `app/`, features in `client/features/`, components in `client/components/ui/`
5. **Generate scaffolding**: `npm run generate component|screen|hook|form <Name>`

## Key Conventions

- **Feature folders** are self-contained and portable — never cross-import between features
- **Zustand** for client state, **TanStack React Query** for server state
- **Discriminated unions** for API responses (no thrown exceptions)
- **Platform-specific files** (`.native.ts` / `.ts`) for clean platform splits
- **Conventional Commits** for git messages
- **Bun** as package manager
