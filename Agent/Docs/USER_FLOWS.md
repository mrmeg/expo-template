# User Flows

This template exposes app-shell flows plus optional auth, media, billing, and
demo/showcase flows.

## Launch

1. `app/_layout.tsx` starts the provider stack.
2. `useAppStartup` waits for fonts/resources, i18n, onboarding state, and
   optional auth bootstrap.
3. Splash hides only after startup is ready.
4. First-run users see `OnboardingGate`; returning users see the main Stack.

On web, startup also has SSR constraints. See `docs/ssr-hydration.md` before
changing first-render behavior.

## Navigation

The main tab shell exposes Explore, Media, Profile, and Settings. Demo and
screen-template routes live under `app/(main)/(demos)/`.

Explore links into the component showcase and reusable screen templates through
`client/showcase/registry.ts`.

## Auth

Auth is disabled unless both Cognito public env vars are set.

When enabled:

- Sign-up collects email/password, then confirmation code.
- Sign-in uses Amplify and updates auth store state.
- Forgot-password flows through request code, reset password, then sign in.
- Protected surfaces render `AuthScreen` inline while unauthenticated.
- Signing out leaves public tabs available and protected tabs gated.

## Media

Media is disabled until R2/S3 env vars are configured.

Upload flow:

1. Pick image/video assets from the Media tab.
2. Compress images and optionally convert unsupported web video formats.
3. Request `/api/media/getUploadUrl`.
4. Upload to the returned presigned URL with matching content type.
5. Upload generated video thumbnails when present.
6. Refresh media list and show toast feedback.

Browse/delete flow:

1. List by media type, or aggregate configured media types for the all-media
   view.
2. Request signed read URLs for visible keys.
3. Preview images or videos.
4. Delete one item or selected visible items.
5. Include generated thumbnail keys when deleting selected videos.

Disabled, auth, and access failures should render setup or auth/access states
instead of retry loops.

## Billing

Billing is Stripe hosted-external and disabled until configured.

Purchase flow:

1. Pricing UI derives CTA state from the normalized billing summary.
2. Authenticated users request `/api/billing/checkout-session` with plan id and
   interval.
3. Web redirects with `window.location`; native uses
   `WebBrowser.openAuthSessionAsync`.
4. Return path refetches billing summary.
5. Stripe webhook updates authoritative server state.

Manage flow:

1. Account/Profile UI calls `/api/billing/portal-session`.
2. User manages subscription in Stripe Billing Portal.
3. Return path refetches billing summary.

Return URLs are not proof of payment. The webhook-driven summary is the source
of truth.

## Settings

Settings owns theme, language, auth actions, and developer-oriented controls.
Theme and language changes persist cross-platform and should respect SSR
first-render constraints on web.

## Errors

React render errors go through the app error boundary and optional Sentry
reporting. API errors should be typed, user-readable, and specific enough to
choose between retry, setup, auth, or access states.

## Accessibility

Preserve safe-area handling, keyboard avoidance, reduced-motion support,
screen-reader labels for tab and form controls, and contrast-aware foregrounds.
Use package primitives where available instead of creating one-off controls.
