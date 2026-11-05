---
components: [Image]
use-for: "Any picture"
---

# Image

`Image` (`components/Image`, needs `expo-image`): a picture that sizes itself
from an aspect ratio instead of fixed pixels. A muted frame shows while it
loads and when it fails (an `image-off` icon, or your `fallback`), then goes
transparent, so a transparent PNG, WebP, SVG or AVIF shows the surface behind
it in both themes.

```tsx
import { Image } from "@mrmeg/expo-ui/components/Image";

<Image source={photo.url} alt={photo.title} aspectRatio={{ width: photo.width, height: photo.height }} radius="md" />
<Image source={cover} alt="" aspectRatio="16:9" maxHeight={240} position="top" />
<Image source={{ uri, cacheKey: key }} alt="" style={{ width: 96, height: 96 }} recyclingKey={key} />
```

- Pick one sizing mode. `aspectRatio` (`16 / 9`, `"16:9"` or
  `{ width, height }`, for example from upload metadata) draws full width of
  the parent at that ratio, capped by `maxWidth` / `maxHeight` and centered;
  prefer it whenever the size is known, since the box is pure style and a
  server-rendered page already carries the final layout. `aspectRatio="auto"`
  starts at `fallbackAspectRatio` (default 1) and moves to the picture's own
  ratio once it loads: one layout shift, once per mount (change `key` to
  re-measure for a new picture). `fill` absolutely fills a positioned parent
  you size. With none of these, size the frame with `style` (width, height,
  flex), as with a raw `expo-image`. `maxHeight` is enforced through the
  width, so a tall picture in a wide column stays centered instead of
  letterboxed.
- `fit` is `cover` by default; `contain`, `fill`, `none` and `scale-down`
  follow CSS `object-fit`, and `position` (`"top"`, `{ top: "20%", left: 0 }`)
  is the focal point of a `cover` or `none` crop. Letterboxing is
  transparent. `radius` takes the `spacing.radius*` names and is applied to
  the frame and the image.
- `alt` is required. Describe the picture; pass `alt=""` for a decorative one
  (a thumbnail inside a pressable that is already named), which hides it from
  assistive tech. A JS caller that omits it gets a development warning and
  the image is treated as decorative.
- In a recycled list (FlashList, FlatList cells) set
  `recyclingKey={item.id}`, so a reused cell shows a blank frame instead of
  the previous picture. Pass `source={{ uri, cacheKey }}` when the URL changes
  but the picture does not (re-signed URLs), so the cache hits.
- `placeholder` takes a blurhash string (bare, or with `blurhash:/`), a
  thumbhash string with its `thumbhash:/` prefix (a bare string is read as a
  blurhash), or a low-resolution URL or `{ uri }`; there is no spinner. `transition` (ms, default 200) is forced to 0 under
  reduced motion. `onLoad({ width, height })` reports the natural size and
  `onError` the failure; a new `source` clears an error. A `null` source keeps
  the frame in its loading look and calls nothing.
- Formats are the platform decoder's. HEIC shows the error state in Chrome
  (it has no HEIC decoder) while iOS and WebKit decode it; convert HEIC to
  JPEG or WebP before serving it to the web (`@mrmeg/expo-media`'s processing
  does). The Media Lab lists what each surface did per format.
- Web: `expo-image` adds its `<img>` after mount, so the server HTML carries
  the sized, muted frame but not the `<img>` (a low-resolution `placeholder`
  URL is the exception). The `<img>` has `alt`, `loading="lazy"` and, from
  `priority`, `fetchpriority`.
