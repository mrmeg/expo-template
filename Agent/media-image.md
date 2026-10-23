---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Image: an expo-image component that sizes itself correctly everywhere

## Goal

Ship `Image` at `@mrmeg/expo-ui/components/Image`, built on `expo-image`. It works on iOS, Android, and web,
including desktop browsers and server-rendered HTML. It sizes from an aspect ratio instead of fixed pixels, offers
every resize mode with focal positioning, and carries placeholder, loading, and error states plus accessible alt
text. `MediaViewer`, `Video` posters and `AudioPlayer` artwork reuse it.

## Stacking

Stacks on spec `media-lab`, which sits on `media-foundation`. Branch `agent/media-image` from `agent/media-lab` (not
`origin/dev`), and open the draft PR against `agent/media-lab`. Retarget it as the parents merge. If `agent/media-lab`
does not exist, skip for this pass with the unblock step "implement media-lab first". Do not mark the spec blocked.
`media-video` and `media-audio` stack on this branch.

## Context

Verified on `dev` at df1a06a (2026-10-23). The parent specs add the pieces below. Read them on `agent/media-lab`
before starting.

- From foundation:
  - `lib/mediaFrame.ts`: `MediaAspectRatio`, `parseAspectRatio`, `mediaFrameStyle` and `useMediaAspectRatio`.
  - Built-in `image-off` icon.
  - `expo-image` as an optional peer.
  - The `## Media` stub in `packages/ui/LLM_USAGE.md`.
  - Subpath-only rule: never add `Image` to `components/index.ts` (`__tests__/mediaPeers.test.ts` enforces it).
    Module-scope styles carry `/*#__PURE__*/` (`packageSideEffects.test.ts`).
- From `media-lab`:
  - the core fixtures in `assets/media/`: `landscape.jpg` (`smptehdbars`, whose top and bottom bands differ),
    `portrait.jpg`, `square.jpg` and `alpha.png`;
  - the `MEDIA_FIXTURES` manifest (`client/showcase/mediaFixtures.ts`) and `resolveFixtureUri`;
  - the `bun run media:fixtures` generator;
  - the Media Lab screen (`client/showcase/MediaLabScreen.tsx`) with its playground state and a `renderers.image`
    slot.
- expo-image 58.0.14 types (`node_modules/expo-image/build/Image.types.d.ts`):
  - `ImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'` (line 74);
  - `contentPosition` (152), `placeholder` (121), `placeholderContentFit` (146), `transition` (157),
    `recyclingKey` (276);
  - `onLoad(event: ImageLoadEventData)` (311; the payload at 675 carries `source.width` and `source.height`);
  - `priority`, `cachePolicy`, and responsive `source` arrays.
- Existing call sites:
  - `app/(main)/(tabs)/media.tsx:964-975` renders thumbnails with raw `expo-image` (`source={{ uri, cacheKey }}`,
    square `style`, `contentFit="cover"`). The comment at 951-955 explains why `cacheKey` is the object key, so keep
    that.
  - `client/features/media/components/ImagePreview.tsx` hand-rolls loading and error overlays. `media-viewer`
    replaces that file, so do not touch it here.
- Radius tokens: `spacing.radiusNone/Xs/Sm/Md/Lg/Xl/2xl/Full` (`packages/ui/src/constants/spacing.ts:49-56`).
  Reduced motion: `useReducedMotion()` from `hooks/useReduceMotion.tsx:79`. Surface for empty or loading:
  `theme.colors.muted`.
- Android drops a parent's `overflow: hidden` clip on child images in some cases (`Avatar.tsx` `imageRadius`
  comment). Put the radius on the image too.
- Web is server-rendered per request (`AGENTS.md`). expo-image web renders an `<img>`, so the first response should
  already contain it. Styles must be module-scope `StyleSheet.create` or `createThemedStyles`, so
  `SsrStyleFlush.tsx` serializes them.
- Showcase:
  - Components are registered in `client/showcase/registry.ts` (`COMPONENTS`, around line 100) and previewed in
    `client/showcase/previews.tsx` (`PREVIEWS`, line 119).
  - Optional seeded detail goes in `client/showcase/details.tsx`.
  - `ComponentCategory` (`registry.ts:47`) has no media category. `ComponentsGalleryScreen.tsx` filters by it, and
    its description at line 151 lists the categories.

## Work

1. **`packages/ui/src/components/Image.tsx`** (new):

   ```ts
   export type ImageFit = ImageContentFit; // re-exported from expo-image types
   export type ImageRadius = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
   export interface ImageProps {
     source: ImageSource | ImageSource[] | string | number | null;
     /** Required. Describe the image; pass "" for decorative images (hidden from assistive tech). */
     alt: string;
     fit?: ImageFit;                      // default "cover"
     position?: ImageContentPosition;     // default "center"; focal point for cover/none crops
     aspectRatio?: MediaAspectRatio | "auto";
     fallbackAspectRatio?: number;        // for "auto" before load; default 1
     maxWidth?: number;
     maxHeight?: number;
     fill?: boolean;                      // absolute-fill the parent
     radius?: ImageRadius;                // default "none"
     placeholder?: string | ImageSource;  // blurhash/thumbhash string or a low-res source
     placeholderFit?: ImageFit;           // default = fit
     transition?: number;                 // ms, default 200; forced 0 under reduced motion
     fallback?: React.ReactNode;          // replaces the default error state
     priority?: "low" | "normal" | "high";
     cachePolicy?: ExpoImageProps["cachePolicy"]; // expo-image's union (import type { ImageProps as ExpoImageProps })
     recyclingKey?: string | null;        // set in recycled lists (FlashList/FlatList)
     onLoad?: (e: { width: number; height: number }) => void;
     onError?: (error: unknown) => void;
     style?: StyleProp<ViewStyle>;        // layout of the frame (margins, width, flex)
     testID?: string;
   }
   ```

   - **Sizing modes.**
     - `fill` uses an absolute-fill frame.
     - `aspectRatio` (number, `"16:9"` or `{width,height}`) uses `mediaFrameStyle`: full width of the parent,
       derived height, clamped by `maxWidth` and `maxHeight` and centered.
     - `"auto"` starts at `fallbackAspectRatio` and switches to the natural ratio from `onLoad`. Document the one-time
       layout shift and recommend an explicit ratio when the size is known, for example from upload metadata.
     - With none of these, the frame is sized by `style` (width/height/flex), the same as raw expo-image.
   - **Structure.** An outer `View` frame (radius, `overflow: hidden`) contains the expo-image `Image`, absolutely
     filling it with `contentFit`, `contentPosition` and the radius applied.
     - The frame paints `theme.colors.muted` only while loading and in the error state. Once loaded it is
       transparent, so a transparent PNG, WebP, SVG or AVIF shows the surface behind it in both themes, not a grey box.
     - `contain`, `scale-down` and `none` letterboxing is transparent too.
   - **States.**
     - Loading: the muted frame shows the `placeholder` when given, otherwise stays muted. No spinner.
     - Error: `fallback`, or by default a centered `image-off` icon in `mutedForeground`. Resolve the size from the
       frame: 24 pt, or 16 pt when the frame is under 48 pt.
     - When `source` changes, clear the error state.
     - `onLoad` reports natural width and height.
   - **Accessibility.**
     - A non-empty `alt` sets `accessible`, `accessibilityRole="image"` and `accessibilityLabel={alt}`. On web,
       confirm the `<img>` gets `alt`; pass `alt` through expo-image's web props if RNW drops the label.
     - `alt=""` hides the image from assistive tech: `accessible={false}`, `importantForAccessibility="no"`, and on web
       `aria-hidden`.
     - In development, `console.warn` once when `alt` is `undefined` at runtime (JS callers).
   - **Web.**
     - Verify the server HTML contains the `<img>` with its `src`. `priority="high"` should reach `fetchpriority`; if
       expo-image does not forward it, note that in the JSDoc rather than patching.
2. **Tests** (`packages/ui/src/components/__tests__/Image.test.tsx`, plus `Image.web.test.tsx` using
   `./forceWebPlatform`):
   - Frame style for each sizing mode: the clamped `maxWidth` math; `"auto"` switches after a simulated `onLoad`.
   - Error state renders the default icon or a custom `fallback`, and resets on a source change.
   - `alt` behavior, including that decorative images are hidden.
   - Reduced motion forces `transition` 0.
   - `fit`/`position` pass through to expo-image.
3. **Showcase.**
   - Add `"media"` to `ComponentCategory` and to every place the gallery lists categories, including the description
     string at `ComponentsGalleryScreen.tsx:151`.
   - Register `{ id: "Image", importPath: "@mrmeg/expo-ui/components/Image", category: "media" }`.
   - Preview in `previews.tsx`:
     - a row of the five `fit` modes on one non-square image;
     - `position="top"` vs `"bottom"` on a cover crop;
     - `aspectRatio="16:9"` with `maxHeight={200}`;
     - `"auto"`;
     - a blurhash placeholder;
     - the error state (an invalid URI).
   - Use the `media-lab` core fixtures (`assets/media/landscape.jpg` etc.). Add no new sample files.
   - Previews load only through the lazy gallery. Never import `Image` from outside `client/showcase/` except in the
     dogfood below (`client/showcase/__tests__/gallerySplitPoint.test.ts`).
4. **Media Lab.** Implement `renderers.image` in `MediaLabScreen.tsx`.
   - Render every `kind: "image"` fixture through `Image`, driven by the playground state (fit, position, sizing mode,
     `maxHeight`, radius, width preset). Image tiles are `Card`s in a wrapping grid.
   - The 60-thumbnail `scale` set renders in a `FlatList` grid with `recyclingKey`.
   - The source-kinds row (bundled, public path, remote, data URI, picked `file://`) renders through `Image`.
   - Run `bun run media:fixtures`, then go through **every** image fixture on each surface you test. Pay particular
     attention to:
     - EXIF orientation 6, which must display portrait;
     - `alpha.png` and the alpha WebP in light and dark;
     - the SVG with no size;
     - the animated GIF, WebP and APNG;
     - the 48 MP image (memory, and downsampling under `contain`);
     - 16×16 upscaling;
     - HEIC and CMYK on web;
     - Display P3;
     - the responsive source array (check the network panel for the width chosen);
     - the broken files.
   - Record what you saw in `observed` (`works`, `fails` or `partial`), and leave untested surfaces unset. Every
     `expectError` fixture must reach the error state, never a crash or a blank frame.
   - A fixture that fails where it should work is a bug to fix here. If it cannot be fixed (a platform gap), list it
     in the PR with evidence and note it in the `LLM_USAGE.md` entry.
5. **Dogfood.** Replace the two raw `expo-image` thumbnails in `app/(main)/(tabs)/media.tsx:964-975` with `Image`.
   Keep `source={{ uri, cacheKey }}` and `fit="cover"`, and use `alt=""` because the wrapping `Pressable` already
   names the item. Drop the `expo-image` import from that file if nothing else uses it.
6. **Docs.**
   - Fill `Image` in the `LLM_USAGE.md` `## Media` section: when to pick each sizing mode, `alt` rules, `recyclingKey`
     in lists, and prefer an explicit `aspectRatio` for SSR-stable layout.
   - Add a CHANGELOG `## [Unreleased]` Added entry.
   - Run `bun run docs:llms`.

## Validation

- `bun run pkg ui typecheck`, `bun run pkg ui test`, `bun run typecheck`, `bun run test`, `bun run lint`,
  `bun lint:ui --changed`.
- `bun run gen --check`, then `bun run build && bun run bundle-size` (expect no eager-bundle growth beyond the
  dogfood).
- Browser, against `bun run build && bun run start`:
  - In the components gallery, the Image preview shows all five fits, the clamped 16:9 frame centered on a wide
    window, auto ratio settling, placeholder then image, and the error icon.
  - View source on the gallery route: the `<img>` tags are in the server HTML.
  - Resize the window from 1280 to 375 px: frames rescale without overflow.
  - The media tab thumbnails still render and cache (no re-download on refetch, per the 951-955 comment).
  - Media Lab, Images section:
    - every fixture under each fit, sizing mode and width preset;
    - transparent fixtures in both themes;
    - broken fixtures show the error icon;
    - the 60-item grid scrolls smoothly;
    - paste the observed table into the PR.
  - Report screenshots.
- Native: iOS simulator via the run skill if available: the gallery preview, the media tab, and the Media Lab Images
  section (generated fixtures load from the dev server). Otherwise list it as
  a manual check in the PR.
