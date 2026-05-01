# App Overview

> High-level overview of the Expo Template application.

## What Is This?

A production-ready **Expo app template** for building cross-platform applications (iOS, Android, Web). It provides foundational infrastructure — authentication, media handling, theming, i18n, a design system, and screen templates — so concrete apps can be built on top without boilerplate setup.

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| iOS | Full support | New Architecture enabled, tablet support |
| Android | Full support | New Architecture enabled |
| Web | Full support | Expo Router SSR through the Express production server |

## Core Capabilities

### Authentication
AWS Cognito via Amplify. Sign up, sign in, email verification, password reset. Token management is automatic. Auth is **optional** — without `EXPO_PUBLIC_USER_POOL_ID` / `EXPO_PUBLIC_USER_POOL_CLIENT_ID` the template is fully explorable; protected tabs (profile, settings) simply render the sign-in screen inline when a Cognito environment is present but the user is signed out.

### App Shell
`client/features/app/` owns startup sequencing and per-surface auth policy. `useAppStartup` holds the splash until fonts, i18n, onboarding, and (optionally) Amplify bootstrap all resolve. `OnboardingGate` runs the first-run flow inline before the main Stack mounts. `AuthGate` wraps protected screens with a no-op / spinner / `AuthScreen` / children branch based on auth state.

### Media Management
Upload, browse, and delete images/videos stored in S3/R2. Client-side compression, HEIC conversion, video thumbnails. Presigned URLs for secure access.

### Design System
35 shadcn-inspired UI components built on @rn-primitives. Zinc-based color palette with teal accent. Full dark mode support. Consistent sizing and spacing tokens.

### Internationalization
English and Spanish with lazy-loaded translation bundles. RTL support. Device locale auto-detection.

### Screen Templates
13 pre-built screen templates: Settings, Profile, List, Pricing, Welcome, Card Grid, Chat, Dashboard, Multi-step Form, Notifications, Search Results, Error States, Detail Hero.

### Billing (baseline)
Stripe **Checkout + Billing Portal** in `hosted-external` mode — web redirects to Stripe, native hands off via `expo-web-browser` through `<APP_SCHEME>://billing/return` (default `myapp`, override via `EXPO_PUBLIC_APP_SCHEME`; see `app.identity.ts`). Stripe webhooks are the authoritative source of billing state; the client consumes a normalized `BillingSummary` keyed to the Cognito `sub`. Native PaymentSheet, App Store / Play Store in-app purchase, metered billing, tax, and team seats are **out of scope for the baseline**. Adopters shipping native apps in regulated digital-goods categories must confirm platform policy before enabling the default. See [BILLING.md](./BILLING.md).

### Developer Tools
Component showcase, form validation demos, auth demos, Reactotron integration, developer settings screen.

## How to Use This Template

1. **Clone and install**: `bun install`
2. **Run as-is**: `npx expo start` — every optional feature (Cognito auth, external API URL, Stripe billing, R2/S3 media) defaults to off, so the template is fully explorable from a fresh `.env.example`.
3. **Enable auth (optional)**: Set both `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID` together. Setting just one warns at startup; setting neither keeps the auth shell disabled.
4. **Enable other features (optional)**: Add S3/R2 credentials for media uploads, billing keys for Stripe (see `BILLING.md`), `EXPO_PUBLIC_API_URL` for an external backend.
5. **Start building**: Add screens in `app/`, features in `client/features/`, components in `client/components/ui/`.
6. **Generate scaffolding**: `bun run generate component|screen|hook|form <Name>` (`screen` writes both `client/screens/<Name>Screen.tsx` and a demo route under `app/(main)/(demos)`).

## Key Conventions

- **Feature folders** are self-contained and portable — never cross-import between features
- **Zustand** for client state, **TanStack React Query** for server state
- **Discriminated unions** for API responses (no thrown exceptions)
- **Platform-specific files** (`.native.ts` / `.ts`) for clean platform splits
- **Conventional Commits** for git messages
- **Bun** as package manager
