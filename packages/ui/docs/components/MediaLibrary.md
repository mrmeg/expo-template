---
components: [MediaTile, MediaGrid, MediaSelectionBar, UploadQueue]
also: [MediaTile, MediaGrid, MediaSelectionBar, UploadQueue]
use-for: "One square tile of a media library; a grid of square tiles; select-all, count, Clear, Delete (N) over a grid; uploads in progress"
---

# MediaLibrary

### Media management components

Presentational pieces for a media library screen: a grid of tiles, a selection
toolbar, and an upload queue. They are subpath-only like the rest of Media
(`MediaTile` and `UploadQueue` draw with `Image`, so they need `expo-image`;
`MediaGrid` and `MediaSelectionBar` need no media peer) and know nothing about
storage keys, signed URLs, queries or `@mrmeg/expo-media`: you pass
primitives in and get the tile `id` back in every callback. Compose them as
`MediaSelectionBar` over a `MediaGrid` of `MediaTile`s, with `useKeySelection`
holding the selection and `UploadQueue` above or beside it.

- `MediaTile` (`components/MediaTile`): one square tile. Props are primitives
  and the component is memoized, so pass callbacks that keep their identity.
  `id`, `kind` (`"image" | "video" | "file"`), `source` (`{ uri, cacheKey? }`
  or a `require()`d asset: an image, or a video's poster), `size` (edge in points), `title` and
  `subtitle` (one line each, under the tile), `selected`, `disabled`. An image
  or file tile is pressable (`onPress(id)`); a video shows a centered play
  button that calls `onPress(id)`. The checkbox chip (top left) and the delete
  chip (top right) render only when `onToggleSelect(id)` / `onDelete(id)` are
  given. The selection ring is drawn over the picture and does not resize it.
  Without a `source` it draws an icon (`play` for video, `image-off` otherwise;
  override with `fallbackIcon`), and the delete chip's glyph is `deleteIcon`
  (default `x`: pass your app's `trash`). Screen-reader labels come from
  `accessibilityLabel ?? title ?? kind` through `openLabel`, `playLabel`,
  `selectLabel` and `deleteLabel`, each a `(name) => string` with an English
  default that goes through `translateText` (`media.tile.open`, `.play`,
  `.select`, `.delete`, each with `{ name }`). `source` is compared by `uri` and
  `cacheKey`, so an inline `{ uri, cacheKey }` does not defeat the memo.

  ```tsx
  <MediaTile
    id={file.key}
    kind="image"
    source={{ uri: file.url, cacheKey: file.key }}
    size={tileSize}
    title={file.name}
    subtitle="1.2 MB"
    selected={selection.isSelected(file.key)}
    onPress={openViewer}
    onToggleSelect={selection.toggle}
    onDelete={confirmDelete}
    deleteIcon="trash"
  />
  ```

- `MediaGrid` (`components/MediaGrid`): a `FlatList` of square tiles.
  `data`, `keyExtractor` and `renderTile({ item, index, size })` (hand `size`
  to `MediaTile`), plus `minTileWidth` (160), `gap` (`spacing.sm`), `rowGap`
  (`spacing.md`), `minColumns` (2) and `maxWidth` (960; the column is centered
  and padded by `spacing.screenPadding`). It measures itself with `onLayout`,
  seeds from the window width, and remounts when the column count changes
  (`numColumns` cannot change on a mounted list). Every other `FlatList` prop
  passes through: `refreshControl`, `ListHeaderComponent`,
  `ListEmptyComponent`, `testID`; `contentContainerStyle` is merged and your
  `onLayout` runs after the grid's. Pass `extraData={selection.selected}` so
  tiles redraw when the selection changes. `mediaGridLayout(width, options)`
  (pure, `{ columns, tileSize }`) and `useMediaGridLayout(options)` are
  exported for a screen that sizes things itself.

  ```tsx
  <MediaGrid
    data={files}
    keyExtractor={(file) => file.key}
    extraData={selection.selected}
    renderTile={({ item, size }) => <MediaTile id={item.key} kind="image" source={{ uri: item.url }} size={size} />}
  />
  ```

- `MediaSelectionBar` (`components/MediaSelectionBar`): the flat toolbar row
  (hairline under it, not a panel) above the grid, in the same capped column.
  `selectedCount`, `totalCount`, `onToggleAll`, `onClear`, `onDelete`, `busy`
  (disables everything) and `deleting` (spinner on Delete). It shows the
  select-all checkbox (indeterminate for a partial selection), "N selected" or
  "N items", Clear once anything is selected, and a destructive "Delete (N)"
  that is disabled at zero. Confirm the delete in your own dialog from
  `onDelete`. Labels (`selectAllLabel`, `deselectAllLabel`, `clearLabel`,
  `selectedSummary(count)`, `totalSummary(count)`, `deleteLabel(count)`) have
  English defaults through `translateText`; `deleteIcon` defaults to `x`.
- `UploadQueue` (`components/UploadQueue`): uploads in progress as `ItemGroup`
  rows. `entries` are `UploadQueueEntry` (`id`, `fileName`, `kind`, `status`:
  `"queued" | "processing" | "uploading" | "done" | "failed"`, `previewUri?`,
  `progress?` 0 to 1, `phase?`, `errorMessage?`); the media package's queue
  items satisfy it as they are. Each row shows a preview (or a kind icon), the
  file name, status text, and a `Progress` bar while processing or uploading
  (determinate when `progress` is a number, else indeterminate). `onRetry(id)`
  adds a retry button to failed rows, `onRemove(id)` a remove button to queued,
  failed and done rows, and `onClearFinished` a header action once anything is
  done or failed; each exists only when its handler does. `title` is the
  section header. `maxVisible` caps the rows drawn and counts the rest in a
  footer (`moreLabel(count)`, default "N more"), so a large pick cannot push a
  grid below it off screen. `statusLabel(entry)` replaces the status text (default
  `uploadQueueStatusLabel`: "Waiting", "Optimizing…", "Converting 42%",
  "Uploading…", "Uploaded", the `errorMessage` or "Failed"); `retryLabel`,
  `removeLabel`, `clearFinishedLabel` and `kindIcons` localize the rest. Each
  row is one screen-reader element reading "file name, status", and a row that
  moves to done or failed is announced once.

  ```tsx
  <UploadQueue title="Uploading" entries={queue.items} onRetry={queue.retry} onRemove={queue.remove} onClearFinished={queue.clearFinished} />
  ```

- `useKeySelection(visibleKeys)` from `hooks`: selection state over string
  keys for the grid above, returning `{ selected, count, isSelected, toggle,
  toggleAll, clear, remove, allSelected, someSelected }`. Selected keys that
  leave `visibleKeys` (an item deleted, a filter changed) are pruned, and
  `toggle`, `toggleAll`, `clear` and `remove` keep their identity. Call
  `remove(keys)` once a delete succeeds.

Built-in glyphs only: the package draws `play`, `image-off`, `x`, `rotate-ccw`,
`check` and `minus` in these components. Your app's registered `trash`,
`video`, `file` and `image` give a closer look through `deleteIcon`,
`fallbackIcon` and `kindIcons`.
