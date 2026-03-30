# Spec: Web SEO Meta Tags

**Status:** Draft
**Priority:** Low
**Scope:** Client

---

## What

Add SEO meta tags to key web pages using Expo Router's `<Head>` component. Include title, description, and Open Graph tags for the main tab screens and the showcase page. Optionally create a reusable SEO helper component to reduce boilerplate.

## Why

When the app is deployed to the web (via `expo export -p web`), pages have no `<title>`, `<meta name="description">`, or Open Graph tags. This means:
- Browser tabs show the default Expo title or no title at all.
- Search engines cannot index pages with meaningful descriptions.
- Social media link previews (Twitter, Slack, Discord) show no title, description, or image.

For a template project, demonstrating proper SEO setup is also educational -- template users need a pattern to follow for their own apps.

## Current State

- `app/+html.tsx` provides the root HTML structure with `<meta charset>`, `<meta viewport>`, and global CSS. It does NOT include `<title>`, `<meta name="description">`, or any Open Graph tags.
- `app/_layout.tsx` is the root layout with providers. It does not use Expo Router's `<Head>` component.
- `app/(main)/(tabs)/_layout.tsx` defines tab navigation but has no `<Head>` usage.
- No existing file in the project uses `expo-router`'s `<Head>` component.
- Expo Router supports `<Head>` for static meta tags on web: `import Head from "expo-router/head"`. This component is web-only and renders nothing on native.

## Changes

### 1. Create reusable SEO component

**New file:** `client/components/SEO.tsx`

```tsx
import { Platform } from "react-native";

interface SEOProps {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
}

/**
 * Web-only SEO meta tags using Expo Router's Head component.
 * Renders nothing on native platforms.
 */
export function SEO({ title, description, ogImage, ogType = "website" }: SEOProps) {
  if (Platform.OS !== "web") return null;

  // Dynamic import avoidance: Head is only available on web
  const Head = require("expo-router/head").default;

  return (
    <Head>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={ogType} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}
    </Head>
  );
}
```

Key design decisions:
- Platform check prevents the `expo-router/head` import on native (where it does not exist or is a no-op).
- Props are simple strings. No complex configuration.
- Open Graph and Twitter Card tags use the same values for consistency.
- The component is intentionally thin -- template users can extend it with canonical URLs, JSON-LD, etc.

**Note:** The exact import strategy for `expo-router/head` should be verified. If `expo-router/head` is safe to import on native (it may just return null), a static import is preferable to the dynamic `require`. Check the expo-router docs and test on both platforms. If the static import works, use:

```tsx
import Head from "expo-router/head";
```

### 2. Add SEO to Explore tab

**File:** `app/(main)/(tabs)/index.tsx`

Add at the top of the `ExploreScreen` component's return value:

```tsx
<SEO
  title="Explore - Expo Template"
  description="Browse UI components, screen templates, and interactive demos built with Expo and React Native."
/>
```

### 3. Add SEO to Profile tab

**File:** `app/(main)/(tabs)/profile.tsx`

```tsx
<SEO
  title="Profile - Expo Template"
  description="User profile screen template with avatar, stats, and editable sections."
/>
```

### 4. Add SEO to Settings tab

**File:** `app/(main)/(tabs)/settings.tsx`

```tsx
<SEO
  title="Settings - Expo Template"
  description="Settings screen with grouped lists, toggles, theme selection, and preferences."
/>
```

### 5. Add SEO to Media tab

**File:** `app/(main)/(tabs)/media.tsx`

```tsx
<SEO
  title="Media - Expo Template"
  description="Upload, compress, and manage photos and videos with cloud storage integration."
/>
```

### 6. Add SEO to Showcase page

**File:** `app/(main)/(demos)/showcase/index.tsx`

```tsx
<SEO
  title="UI Components - Expo Template"
  description="Interactive showcase of 34 UI components: buttons, inputs, dialogs, tabs, and more."
/>
```

### 7. Add default title to root HTML

**File:** `app/+html.tsx`

Add a default `<title>` tag inside `<head>` as a fallback for pages that do not set their own:

```tsx
<title>Expo Template</title>
<meta name="description" content="A production-ready Expo and React Native template with UI components, screen templates, and best practices." />
```

This provides a sensible default when no page-level `<Head>` component overrides it.

## Acceptance Criteria

1. The `SEO` component exists at `client/components/SEO.tsx` and renders web-only meta tags.
2. All 4 tab screens (Explore, Profile, Settings, Media) include `<SEO>` with unique titles and descriptions.
3. The showcase page includes `<SEO>` tags.
4. `app/+html.tsx` has a default `<title>` and `<meta name="description">` tag.
5. On native (iOS/Android), the `SEO` component renders nothing and causes no errors.
6. On web, browser tabs show the correct page title.
7. Viewing page source on web shows the correct Open Graph and Twitter Card meta tags.
8. TypeScript compiles with no new errors.
9. No changes to native behavior or appearance.

## Constraints

- Use Expo Router's built-in `<Head>` component (from `expo-router/head`). Do not add `react-helmet` or other third-party head management libraries.
- The `SEO` component must be safe to import and render on native platforms (no crashes, no warnings).
- Keep descriptions concise (under 160 characters) for search engine compatibility.
- Do not add page-specific SEO to every demo route -- only the main tab screens and showcase. Demo routes are not intended to be indexed.
- Titles should follow the pattern: `"Page Name - Expo Template"`.

## Out of Scope

- Adding a sitemap.xml or robots.txt.
- Adding structured data (JSON-LD) for rich search results.
- Adding canonical URL tags (requires knowing the deployment domain).
- Server-side rendering (SSR) for SEO -- Expo's web export is static/client-rendered.
- Adding SEO to all demo route pages (only main pages matter for SEO).
- Adding a favicon or app icon meta tags (these are typically configured in `app.json`).

## Files Likely Affected

**New files:**
- `client/components/SEO.tsx`

**Modified files:**
- `app/+html.tsx` (add default title and description)
- `app/(main)/(tabs)/index.tsx` (add SEO component)
- `app/(main)/(tabs)/profile.tsx` (add SEO component)
- `app/(main)/(tabs)/settings.tsx` (add SEO component)
- `app/(main)/(tabs)/media.tsx` (add SEO component)
- `app/(main)/(demos)/showcase/index.tsx` (add SEO component)

## Edge Cases

- **expo-router/head import on native:** The `Head` component from `expo-router/head` may or may not be importable on native. If it throws on import, the Platform.OS guard with dynamic `require()` handles this. If it is safely importable (returns null on native), a static import is cleaner. Test both approaches.
- **Duplicate title tags:** If `app/+html.tsx` sets a default `<title>` and a page also uses `<Head>` to set `<title>`, the page-level tag should win (Expo Router's Head replaces, not appends). Verify this behavior.
- **Static export:** `expo export -p web` generates static HTML. Verify that `<Head>` tags are included in the static output (they should be, as Expo Router handles this during static rendering).
- **Async routes:** The project uses async routes on web (`asyncRoutes: "development"` or similar). Verify that `<Head>` works correctly with code-split routes.

## Risks

- **expo-router/head API stability:** The `Head` component API may change between Expo Router versions. This is a stable API as of Expo SDK 55, but document the import path so it is easy to update.
- **No SSR benefit:** Since the app is client-rendered on web, search engine crawlers that do not execute JavaScript will not see the meta tags from `<Head>`. The default tags in `app/+html.tsx` mitigate this partially. Full SSR is out of scope.
- **Platform.OS check overhead:** The Platform.OS check in the SEO component adds minimal overhead. On native, the component returns null immediately. This is the standard pattern for web-only features in React Native.
