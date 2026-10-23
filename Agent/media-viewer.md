---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# MediaViewer: a full-screen lightbox with swipe, zoom, and video

## Goal

Ship `MediaViewer` at `@mrmeg/expo-ui/components/MediaViewer`. It is a full-screen lightbox for a list of images and
videos that works on iOS, Android, and web (desktop and mobile browsers):

- **Navigation:** swipe or arrow between items.
- **Images:** pinch, double-tap, trackpad, and keyboard zoom.
- **Videos:** play with the custom controls from `Video`.
- **Dismiss:** close by button, Esc, back, or swipe-down.

The template's media tab then swaps its two single-item modals for one viewer over the whole library.

## Stacking

Stacks on spec `media-video` (needs `Image` and `Video`). Branch `agent/media-viewer` from `agent/media-video` and
open the draft PR against `agent/media-video`. Retarget it as the parents merge. If `agent/media-video` does not
exist, skip with the unblock step "implement media-video first".

## Context

Verified on `dev` at 54e0bc9.

- **From `media-foundation`:** subpath-only rule (`__tests__/mediaPeers.test.ts`), `/*#__PURE__*/` on module-scope
  styles (`packageSideEffects.test.ts`), `MediaControlButton` (`tone="overlay"`), `useMediaKeyboard` (prev/next, escape, and
  zoom handlers), and the built-in `x`, `chevron-left`, `chevron-right` icons.
- **From `media-image`:** `Image` with `fill`, `fit="contain"`, and `onLoad` natural size.
- **From `media-video`:** `Video` with `controls`, `poster`, and `player`. In custom mode on native, `Video`'s own
  fullscreen opens a second `Modal`. Inside the viewer that is redundant, so pass `allowsFullscreen={false}`. The
  viewer is already full-window, and on web it requests real fullscreen itself (Work 1, Keyboard).
- **Gestures:** `scripts/check-ui-forbidden-imports.mjs` bans reanimated and worklets in `packages/ui`. Build zoom
  and pan with RN `PanResponder` plus `Animated`, following `Drawer.tsx:542-600`. Use `useNativeDriver` only for
  transform and opacity on native (RNW has no native driver). `react-native-gesture-handler` is a peer, but the kit
  does not use its gesture API, and its `>=2.30 <4` range spans two API generations.
- **Modal:**
  - RN `Modal`, as `Dialog.tsx` uses it. Reuse its `SUPPORTED_ORIENTATIONS` (`Dialog.tsx:21`) by moving it to a
    shared module if needed.
  - RNW's `Modal` ships `ModalFocusTrap` (`node_modules/react-native-web/dist/exports/Modal/ModalFocusTrap.js`).
  - The existing modals read the safe area with an `initialWindowMetrics` fallback because a Modal may sit outside
    `SafeAreaProvider` (`client/features/media/components/VideoPlayer.tsx:62-64`). Do the same.
- **Paging precedent:** `Carousel.tsx` (horizontal `ScrollView`, `scrollTo` by index, and web-specific index
  reporting at lines 52-60 and 242-300). Reuse its web lessons; RNW emits no momentum events.
- **App call sites:**
  - `app/(main)/(tabs)/media.tsx:874-893` renders `VideoPlayer` or `ImagePreview` for one item from
    `mediaViewer` state (`dispatchMediaViewer`). They are the only importers of
    `client/features/media/components/{VideoPlayer,ImagePreview}.tsx`.
  - Tiles call `onPreviewImage(filename, signedUrl)` / `onPlayVideo(filename, signedUrl)`.
  - Video thumbnails come from `thumbnailUrl` / `getVideoThumbnailKey`.

## Work

0. **Spike first.** Before building chrome, prove on the iOS simulator and on Android (emulator or device, if
   available) that a two-finger `PanResponder` pinch inside a page of the paging `FlatList` claims the responder:
   `onStartShouldSetPanResponderCapture` / `onMoveShouldSetPanResponderCapture` when `touches.length === 2`, and
   `onPanResponderTerminationRequest: () => false` while pinching. Native scroll views often win this negotiation.
   If the pinch cannot reliably beat the list, stop and report the finding with what you tried; do not ship a flaky
   zoom. If no simulator is available, implement as specified and list the spike as the first manual check in the
   PR.

1. **`packages/ui/src/components/MediaViewer.tsx`** (new):

   ```ts
   export type MediaViewerItem =
     | { type: "image"; key: string; source: ImageSource | string; alt: string; title?: string; placeholder?: string }
     | { type: "video"; key: string; source: VideoSource; title?: string; poster?: ImageSource | string };
   export interface MediaViewerProps {
     items: MediaViewerItem[];
     visible: boolean;
     onClose(): void;
     index?: number;                    // controlled
     initialIndex?: number;             // uncontrolled, default 0
     onIndexChange?(index: number): void;
     videoControls?: "custom" | "native"; // default "custom"
     zoom?: boolean;                    // default true
     maxZoom?: number;                  // default 4
     doubleTapZoom?: number;            // default 2.5
     swipeToDismiss?: boolean;          // default true (native touch only)
     testID?: string;
   }
   ```

   - **Shell:**
     - `Modal` with `transparent` (for the dismiss fade), `animationType="fade"` (`"none"` under
       `useReducedMotion()`), `statusBarTranslucent`, `supportedOrientations`, and `onRequestClose={onClose}`
       (Android back).
     - Black backdrop and a light status bar. Use RN `StatusBar` with a `-- reason` disable of
       `expo-ui/no-raw-primitives`, as the app modals do.
     - Measure the window with `onLayout` on the root and re-measure on rotation and resize.
   - **Paging:**
     - A horizontal `FlatList` with `pagingEnabled`, `getItemLayout` from the measured width, `initialScrollIndex`,
       `windowSize={3}`, `keyExtractor={item.key}`, and `scrollEnabled={!zoomed}`.
     - The active index comes from `onMomentumScrollEnd` on native and from a debounced `onScroll` on web (see
       `Carousel`). Controlled `index` changes scroll to the page.
     - Only the active page mounts a `Video`; other video pages show their `poster` (or black) and a play glyph.
       Leaving a page unmounts its player, which stops playback.
     - Re-measuring the width keeps the current index by calling `scrollToOffset` without animation.
   - **Zoom** (images only, internal `ZoomableImage`):
     - Contain-fit image in a page-sized `Animated.View`, with `scale` and `translate` as `Animated.Value`s.
     - `PanResponder` for two-touch pinch: scale = start × distance ratio, anchored at the pinch midpoint, clamped to
       `[1, maxZoom]`, with a spring to 1 if released below 1.
     - One-finger pan only while `scale > 1`. Clamp translation so the image edge never goes past the viewport edge,
       using the natural size from `onLoad` and the contain math.
     - Double-tap (two taps within 250 ms and 20 pt) toggles between 1 and `doubleTapZoom` at the tap point.
     - Report `zoomed` up so paging turns off while zoomed. A page change resets zoom.
     - **Web:**
       - Ctrl/⌘ + `wheel` zooms around the cursor. Trackpad pinch on Chrome, Edge, and Firefox arrives as wheel
         events with `ctrlKey`. Attach the listener with `{ passive: false }` on the page's DOM node so
         `preventDefault` stops page zoom.
       - Double-click toggles zoom.
       - Mouse drag pans when zoomed (`PanResponder` works with the mouse on RNW).
       - Cursor: `zoom-in` at 1, `grab`/`grabbing` when zoomed.
       - Safari `gesturestart`/`gesturechange` is optional. If skipped, list it as a follow-up in the PR.
   - **Swipe to dismiss** (native touch, `scale === 1`): a vertical drag translates the page and fades the backdrop.
     Release past 120 pt or at velocity > 1 calls `onClose`. Otherwise the page springs back. Under reduced motion,
     close without the drag animation.
   - **Chrome:**
     - Top bar over a `withAlpha(palette.black, 0.45)` scrim, padded by the top safe area:
       - close `MediaControlButton` (`x`, label `translateText("media.close", "Close")`);
       - the item `title` (one line, white);
       - an `"{n} of {total}"` counter (`translateText("media.counter", …)`), hidden for a single item.
     - Prev/next `MediaControlButton`s (`chevron-left`/`chevron-right`) sit vertically centered at the edges:
       - show them on web always, but hidden for the first or last item;
       - show them on native only when a screen reader is on (swipe is the touch affordance).
     - A tap on an image page toggles chrome. Fade with `Animated`; under reduced motion, show or hide without
       animation.
     - Video pages keep the top bar and use `Video`'s own controls.
   - **Keyboard (web):** `useMediaKeyboard` on the root, focused on open.
     - ←/→ go to previous/next; when a custom video is the focused element, its own ←/→ seek wins, and the viewer only
       handles keys that reach it.
     - Esc closes, or exits zoom first when zoomed.
     - `+`/`=`/`-`/`0` zoom.
     - F toggles `requestFullscreen()` on the root node.
   - **Accessibility:**
     - On open, focus the close button: `AccessibilityInfo.setAccessibilityFocus` on native, `.focus()` on web.
     - Announce `"{title}, {n} of {total}"` on page change (`AccessibilityInfo.announceForAccessibility`).
     - The root has `accessibilityViewIsModal`.
     - Image pages carry the item `alt`.
     - Native `accessibilityActions` on the page: `increment`/`decrement` go to next/previous; `escape` closes (iOS
       two-finger Z).
   - **Edge cases:**
     - An empty `items` array renders nothing.
     - An out-of-range index clamps.
     - When `items` changes while open (an item deleted), keep the same `key` if it is still present, otherwise clamp.
2. **Tests** (`MediaViewer.test.tsx`, `MediaViewer.web.test.tsx`; mock `expo-video` with
   `@/test/mocks/expoVideo`):
   - **Render and navigation:**
     - It renders the item at `initialIndex`, and the counter text matches.
     - Prev/next and `increment`/`decrement` change the index and call `onIndexChange`.
     - Controlled `index` is respected.
     - Only the active video page mounts a player.
   - **Closing:** the close button, `onRequestClose`, and Esc call `onClose`. Esc while zoomed resets zoom first.
   - **Zoom:**
     - Test the pure zoom math in `packages/ui/src/lib/mediaZoom.ts` (extract it; internal, not re-exported from
       `lib/index.ts`; a `.ts` file under `components/` would fail `workspaceSourceCondition.test.ts`): clamp,
       anchor, double-tap target, and pan bounds for portrait and landscape images in portrait and landscape
       viewports.
     - Zoom disables paging, and a page change resets zoom.
   - **Web and resilience:** ctrl+wheel calls the zoom handler (dispatch a `WheelEvent` on the node). Deleting the
     active item clamps the index.
3. **Showcase.**
   - Register `{ id: "MediaViewer", importPath: "@mrmeg/expo-ui/components/MediaViewer", category: "media" }`.
   - The preview is a three-thumbnail strip (sample image, landscape video poster, portrait video) built with
     `Image`. Tapping opens the viewer at that item, with the samples from the earlier specs.
   - Keep it behind the lazy gallery.
4. **Dogfood.**
   - In `app/(main)/(tabs)/media.tsx`:
     - Build `MediaViewerItem[]` from the loaded media list: images use their signed URL with `cacheKey`; videos use
       their signed URL with `poster` from `thumbnailUrl`. `key` is the object key, and `title` is the filename.
     - Replace the `mediaViewer` single-item state with an open index (or key).
     - Make `onPreviewImage`/`onPlayVideo` open the viewer at that item.
     - Render one `<MediaViewer>`.
   - Delete `client/features/media/components/ImagePreview.tsx` and `VideoPlayer.tsx`. Update any test that
     references them; first grep `client/features/media` and `app` to confirm there are no other importers.
5. **Docs.**
   - Fill in `MediaViewer` in the `LLM_USAGE.md` `## Media` section: item shape, controlled vs uncontrolled,
     zoom/keyboard/gesture summary, and "build items from your list so swipe spans the library".
   - Add a CHANGELOG `## [Unreleased]` Added entry, then run `bun run docs:llms`.

## Validation

- `bun run pkg ui typecheck`, `bun run pkg ui test`, `bun run typecheck`, `bun run test`, `bun run lint`,
  `bun lint:ui --changed`, `bun run gen --check`.
- `bun run build && bun run bundle-size`. Confirm the media tab route's script set and that the viewer does not reach
  the eager entry.
- Browser, against `bun run build && bun run start`:
  - In the gallery preview and the media tab (with media env configured, or the gallery only if not), check:
    - arrow keys and buttons page through the items;
    - ctrl+wheel and trackpad pinch zoom at the cursor;
    - drag pans within bounds;
    - double-click toggles zoom;
    - Esc unzooms, then closes;
    - F toggles fullscreen;
    - a video page plays with custom controls and stops when you page away.
  - Resize between 1280 and 375 px while open: the current item stays put.
  - Check the console for no hydration warnings.
  - Report screenshots.
- iOS simulator (run skill), if available: swipe paging, pinch and double-tap zoom with edge clamping, paging off
  while zoomed, swipe-down dismiss, rotation, and video playback.
- Put Android back-button close and VoiceOver/TalkBack navigation in the PR's manual checks.
