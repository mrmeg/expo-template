---
components: [MediaViewer]
use-for: "Full-screen lightbox over images and videos"
---

# MediaViewer

`MediaViewer` (`components/MediaViewer`, needs `expo-image` and `expo-video`):
a full-screen lightbox for a list of images and videos, on iOS, Android and
web. Build `items` from your whole list so swiping spans the library, and open
it at the one that was tapped.

```tsx
import { MediaViewer, type MediaViewerItem } from "@mrmeg/expo-ui/components/MediaViewer";

const items: MediaViewerItem[] = media.map((m) =>
  m.kind === "video"
    ? { type: "video", key: m.id, source: m.url, poster: m.thumbnail, title: m.name }
    : { type: "image", key: m.id, source: { uri: m.url, cacheKey: m.id }, alt: m.description, title: m.name },
);
const [open, setOpen] = useState<number | null>(null);

<MediaViewer items={items} visible={open !== null} initialIndex={open ?? 0} onClose={() => setOpen(null)} />
<MediaViewer items={items} visible index={index} onIndexChange={setIndex} onClose={close} videoControls="native" maxZoom={6} />
```

- Items. `type: "image"` takes `source` (a URL, a `require()`d asset or an
  `expo-image` source with `cacheKey`), a required `alt` (`""` for a
  decorative picture), an optional `title` and a `placeholder` (blurhash,
  thumbhash or low-resolution URL). `type: "video"` takes `source` (an
  `expo-video` source), an optional `title` and a `poster`. `key` must be
  unique and stable (an object key or id): it is how the viewer follows an
  item. An empty list renders nothing.
- Position. Uncontrolled by default: `initialIndex` is read once per open
  (the viewer remounts each time `visible` turns true). Pass `index` and
  `onIndexChange` to control it. An index past the list is clamped, and
  `onIndexChange` reports the clamp. If `items` changes while the viewer is
  open (an item deleted elsewhere), it stays on the same `key` if it is still
  there, otherwise it clamps, and `onIndexChange` reports the move. A video
  whose `source` changes restarts (`Video` replaces a source in place), so
  with signed URLs that a refetch re-signs, snapshot `items` when you open the
  viewer and pass the snapshot while it is open, as the template's media tab
  does.
- Paging is a horizontal swipe, the arrow keys, or the edge buttons. The
  buttons show on web always (hidden on the first and last item) and on native
  only while a screen reader is on, since swipe is the touch affordance. The
  counter ("3 of 5", `media.counter`) is hidden for a single item. Only the
  shown page and its two neighbors are mounted, so a list of hundreds stays
  light. Only the shown page mounts a `Video`; the other video pages show their
  `poster` (or black) and a play glyph, so paging away stops playback and a
  long list never holds many decoders.
- Zoom is for images (`zoom={false}` turns it off): pinch, double-tap
  (`doubleTapZoom`, default 2.5) or double-click, `Ctrl`/`Cmd` + wheel around
  the cursor (a trackpad pinch on Chrome, Edge and Firefox arrives that way;
  Safari's own pinch event is not handled), and `+` `-` `0`, up to `maxZoom`
  (default 4). One finger or the mouse pans a zoomed image, never past its
  edge. Paging is off while zoomed, and a page change resets zoom. A tap on an
  image toggles the chrome; a video page keeps its top bar and the video's own
  controls (`videoControls`: `"custom"` by default, or the platform's).
  `autoPlay` starts each video page as it is shown (the one opened on and each
  one paged to), as a photo library does; it is off by default. Set it when
  the user opens the viewer by tapping a video. A browser that blocks unmuted
  autoplay leaves the page paused with its play button showing.
- Closing: the close button, Esc, Android back, and on a touch screen a swipe
  down (or up) past 120 pt or faster than 1 pt/ms, which fades the backdrop
  with the drag (`swipeToDismiss={false}` turns it off). Esc leaves zoom first
  and closes on the second press. There is no swipe-to-dismiss with a mouse.
- Web keys, on the viewer's root: ←/→ page, `+` `=` `-` `0` zoom, `F` toggles
  browser fullscreen of the viewer. A custom video that has focus keeps its own
  ←/→ for seeking. `Video` is told `allowsFullscreen={false}` inside the
  viewer, since the viewer is already full-window.
- Accessibility: focus lands on the close button when it opens, each page
  change is announced ("Title, 2 of 5"), the root is a modal view, and an image
  page is one element named by its `alt`. On native an image page offers
  `increment` and `decrement` (next and previous) and `escape` (close, iOS
  two-finger Z); a video page leaves increment and decrement to the video's
  own controls, so a screen reader pages with the edge buttons there. Copy goes
  through `translateText`: `media.close`, `media.counter` (with `n` and
  `total`), `media.previous`, `media.next` and `media.imageError`.
- It is a transparent `Modal` that fades (no animation under reduced motion),
  black in both themes, with a light status bar, and it supports every
  orientation. It reads the safe area with the `initialWindowMetrics` fallback
  a `Modal` outside `SafeAreaProvider` needs. Gestures are RN `PanResponder`
  plus `Animated`; the kit does not use reanimated or gesture-handler.
- In an app, keep it out of the first download. `MediaViewer` imports `Video`
  and `Image`, so a static import from two lazy chunks hoists `expo-video`
  into the shared bundle. The template loads it through
  `client/components/LazyMediaViewer.tsx` (one `import()` of
  `client/components/mediaChunk.ts`, shared with `LazyVideo`), and a test
  fails on any other import. The Media Lab's Viewer section (`/media-lab`) opens
  the viewer on a mixed set (extreme aspects, a 48 MP picture, EXIF
  orientation, alpha PNG, animated GIF, a rotation-flagged video, HLS with
  captions, broken files), the 60-thumbnail scale set, and one item; check it,
  not memory, on each surface.

