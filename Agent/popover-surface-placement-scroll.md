---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/119
---

# Popover: keep the surface, open where there is room, scroll when tall

## Goal

Make `PopoverContent` correct by default so consumers stop patching it: a caller
`style` adjusts the surface instead of replacing it; content opens on the side
with room and stays inside the safe area; content taller than that room scrolls,
iOS included; web content never lays out wider than the viewport.
`PopoverTrigger` types its ref. Mindmap carries a workaround for each of these;
they become deletable once this ships.

## Context

Verified on `dev` at `748513d` (RN 0.88.0-rc.0, `@rn-primitives/popover` and
`@rn-primitives/hooks` 1.5.2). All in `packages/ui/src/components/Popover.tsx`
unless noted.

- **Surface.** `PopoverContent` renders
  `<PopoverPrimitive.Content style={contentStyle} {...props} />`, so any caller
  `style` replaces background, border, radius, padding and shadow outright.
  `DropdownMenuContent` (`DropdownMenu.tsx`) already destructures
  `style: styleOverride` and merges it after its defaults.
- **Insets and flip.** `PopoverContent` passes no `insets`; `DropdownMenuContent`
  and `SelectContent` pass `useSafeAreaInsets()`. Native placement is
  `useRelativePosition` / `getSidePosition` in `@rn-primitives/hooks`: it never
  flips `side`; with collisions on it clamps `top` into
  `[insets.top, screen.height − insets.bottom − contentHeight]`, using
  `Dimensions.get("screen")`. With no insets, an oversized popover lands at y = 0
  under the status bar or pinned to the bottom edge, covering its own trigger. It
  already caps `maxWidth` at `screen.width − insets.left − insets.right`.
- **Height.** Nothing caps content to the room on its side, and nothing scrolls.
- **iOS scroll.** The primitive's native `Content` sets
  `onStartShouldSetResponder={() => true}`
  (`node_modules/@rn-primitives/popover/dist/popover.mjs`) because the `Overlay`
  wraps it and closes on press. RN iOS `RCTScrollViewComponentView` returns `NO`
  from `touchesShouldCancelInContentView:` whenever an ancestor is the JS
  responder (`_shouldDisableScrollInteraction`,
  `node_modules/react-native/React/Fabric/Mounting/ComponentViews/ScrollView/RCTScrollViewComponentView.mm`).
  So a `ScrollView` inside `PopoverContent` never drags on iOS unless the drag
  starts on a pressable, which claims the responder itself. Android scrolls. This
  was device-verified in mindmap on the iPhone 17 Pro Max simulator: the content
  offset stayed at 0 until the responder claim moved inside the ScrollView.
- **Web.** The primitive's web `Content` forwards only `align`, `side`,
  `sideOffset`, `alignOffset`, `avoidCollisions` and the dismiss callbacks to
  Radix `Popover.Content`. It drops `insets`, has no way to pass
  `collisionPadding`, and renders the caller's View inside Radix's content
  element. Radix flips and shifts, and it sets
  `--radix-popover-content-available-width/height` on that element, but applies
  no size cap. A wrapping row of `width: "50%"` items therefore lays out at the
  sum of its items' widths: 769 px in a 390 px viewport in mindmap. The web
  `Overlay` is a plain `Pressable`; outside dismissal is Radix's.
- **Trigger ref.** `PopoverTriggerProps = PopoverPrimitive.TriggerProps` is
  `ComponentPropsWithoutRef`-based, so `<PopoverTrigger ref>` fails to type-check.
  The ref still reaches the primitive at runtime (React 19 ref-as-prop) and
  exposes `open()` / `close()` (`PopoverPrimitive.TriggerRef`).
- **Tests.** `components/__tests__/overlayContentBounds.test.tsx` locks
  `Overlay > fill wrapper (absoluteFill, box-none) > Content` for Popover,
  DropdownMenu, Select and Tooltip (Android hit-testing). The root
  `test/setup.ts` mocks safe-area insets to zero. `Dialog.test.tsx` flips
  `Platform.OS` at runtime and restores it.
- **Mindmap workarounds** (the other repo, reference only):
  - `client/components/graph/FloatingControlPanel.tsx`: restated surface; a
    `PanelBody` height cap with a responder claim inside its ScrollView;
    `maxWidth`; `side` picked per panel.
  - `client/components/search/SearchResultsPopover.tsx`: restated surface.
  - `client/lib/popoverTriggerRef.ts`: ref type cast.

## Work

Branch on `Platform.OS` at render time, not module scope, so tests can flip it
(the existing module-scope `FullWindowOverlay` constant stays).

1. **Surface merge.** Destructure `style` and pass
   `StyleSheet.flatten([defaults, placementStyle, style])` after `{...props}`, as
   `DropdownMenuContent` does. The caller wins key by key; everything it leaves
   unset keeps the default.
2. **Safe-area insets.** Default `insets` to `useSafeAreaInsets()`; a caller
   `insets` prop still wins.
3. **Flip and height cap (native).** New module
   `packages/ui/src/lib/popoverPlacement.ts`. Not `components/`: `./components/*`
   is a public wildcard export, and this helper is internal.
   - Signature:
     `resolvePopoverPlacement({ side, sideOffset, trigger, screenHeight, insets, naturalHeight, avoidCollisions })`
     returns `{ side, maxHeight }`.
   - Room above = `trigger.pageY − sideOffset − insets.top`.
   - Room below = `screenHeight − insets.bottom − (trigger.pageY + trigger.height + sideOffset)`.
   - Keep the requested side (default `"bottom"`, as in the primitive) when
     `naturalHeight ≤` its room. Otherwise take the opposite side if its room is
     larger.
   - `maxHeight` is the chosen side's room, floored at 120; below that the
     primitive's inset clamp places it.
   - `avoidCollisions === false`, or no trigger yet: the requested side, no cap.
   - No natural height (not measured yet, or `scrollable={false}`): the
     requested side, capped to its room, no flip.

   In `PopoverContent`:
   - Read `triggerPosition` and `contentLayout` from
     `PopoverPrimitive.useRootContext()`; Content renders under Root.
   - Use `Dimensions.get("screen").height`, which is what the primitive clamps
     against.
   - Pass the resolved `side` to the primitive, and put `maxHeight` into
     `placementStyle`.
   - When `scrollable`, add `opacity: 0` to `placementStyle` until the natural
     height is known, so a flip never shows the unflipped frame. Omit the key
     afterwards (and always with `scrollable={false}`): the primitive's own
     hidden-until-measured style must still apply.
4. **Scroll body.** Wrap `children` in a `ScrollView` inside the Content
   (`alwaysBounceVertical={false}`, `keyboardShouldPersistTaps="handled"`).
   - The ScrollView shrinks into the capped Content and scrolls.
   - `naturalHeight` = `contentLayout.height − the ScrollView's laid-out height
     (onLayout) + its content height (onContentSizeChange)`. That is the card's
     own chrome plus the uncapped content, with no parsing of padding styles.
   - New prop `scrollable?: boolean`, default `true`. With `false`, children
     render directly; this is for content that brings its own `FlatList`, since a
     VirtualizedList inside a vertical ScrollView warns.
   - With `scrollable={false}` the cap still applies and the child list shrinks
     into it. The package cannot see the uncapped height there, so that mode
     caps but never flips; the caller picks `side`.
5. **Native tree that lets iOS scroll.**
   - On iOS and Android, render the `Overlay` (absolute fill, closes on press) as
     a sibling before the fill wrapper instead of around it:
     `Portal > FullWindowOverlay > [Overlay, AnimatedView(absoluteFill, box-none) > providers > Content]`.
   - Pass `onStartShouldSetResponder={() => false}` to the Content, placed before
     `{...props}` so a caller can still override it. No ancestor of a scroll view
     is the JS responder any more.
   - Presses on blank space inside the card reach nothing and do not close it;
     presses outside land on the Overlay.
   - Keep the fill wrapper and its Android hit-testing comment. Web keeps today's
     tree.
6. **Web size caps.** On web, `placementStyle` is
   `{ maxWidth: "var(--radix-popover-content-available-width)", maxHeight: "var(--radix-popover-content-available-height)" }`,
   cast the way `DropdownMenu.tsx` casts its web-only styles.
   - Radix does the flip on web.
   - rn-primitives' web Content cannot forward `collisionPadding`, so a card
     wider than the space beside its trigger can sit flush against the viewport
     edge. Document that.
7. **Trigger ref type.**
   `type PopoverTriggerProps = PopoverPrimitive.TriggerProps & React.RefAttributes<PopoverPrimitive.TriggerRef>`.
   Export `type PopoverTriggerRef = PopoverPrimitive.TriggerRef`.
8. **Showcase.** Add a "Tall content" row to the Popover section of
   `client/showcase/ShowcaseScreen.tsx`:
   - A `side="top"` trigger whose content has about 20 text rows and a package
     `Switch`. Scrolled near the top of the screen it shows the flip, the cap,
     scrolling, and a native control inside.
   - A trigger whose content has a two-column wrapping row, for the web width
     check.
   - Give one of them a layout-only `style` (padding from a spacing token), so
     the merge is visible. No appearance overrides through `style`; the
     design-system lint rejects them.
9. **Tests first.** New `components/__tests__/Popover.test.tsx`:
   - Setup:
     - Mock `@rn-primitives/popover` as `overlayContentBounds.test.tsx` does, but
       have Content forward every prop and let the Overlay take `onPress`.
     - Add a `useRootContext` whose `triggerPosition` and `contentLayout` tests
       can set.
     - Mock safe-area with non-zero insets.
   - A caller `style` keeps `backgroundColor`, `borderWidth` and `borderRadius`
     and overrides `padding`.
   - Default `insets` equal the safe area; a caller `insets` wins.
   - `resolvePopoverPlacement` table:
     - fits: keeps the requested side;
     - too tall with more room opposite: flips;
     - fits neither side: takes the larger room;
     - the 120 floor;
     - `avoidCollisions: false`;
     - no trigger;
     - no natural height: capped, not flipped.
   - Native: the Content's `onStartShouldSetResponder` returns `false`, and the
     Overlay is not an ancestor of the Content.
   - Native flip wiring: with a trigger near the bottom and a reported natural
     height taller than the room below, the Content gets `side="top"` and a
     `maxHeight`.
   - `scrollable={false}` renders no ScrollView.
   - Web (`Platform.OS = "web"`, restored after): the Content style carries both
     Radix variables.
   - `<PopoverTrigger ref={createRef<PopoverTriggerRef>()} />` type-checks. The
     file is under `ui:typecheck`.

   Update the Popover case in `overlayContentBounds.test.tsx` for the sibling
   Overlay; the fill wrapper stays absolute-fill and `box-none`.
10. **Docs.**
    - `packages/ui/README.md`: Popover notes beside the overlay paragraph (~line
      756). Cover: `style` merges; `side` is a preference that flips when there
      is no room; insets default to the safe area; tall content scrolls, and
      `scrollable={false}` opts out; the web edge caveat.
    - `packages/ui/LLM_USAGE.md`: one line where Popover is listed.
    - `CHANGELOG.md` `[Unreleased]`:
      - Fixed: surface merge, placement, iOS scroll, web width.
      - Added: `scrollable` and `PopoverTriggerRef`.
    - Then run `bun run docs:llms`. No version bump; the release workflow does
      it.

## Validation

- `bun run ui:test`, `bun run ui:typecheck`, `bun run typecheck`, `bun run lint`,
  `bun lint:ui --changed` (the showcase is under `client/`, which `verify` does
  not lint), `bun run docs:llms:check`, `bun run verify`.
- iOS simulator and Android emulator (`bun run ios` / `bun run android`,
  showcase Popover section), in light and dark:
  - A `side="top"` trigger near the top of the screen opens below instead.
  - Tall content caps between its trigger and the safe area, and scrolls with a
    drag that starts on text.
  - The `Switch` inside toggles.
  - Tapping blank space inside keeps the popover open; tapping outside closes it.
  - The showcase popover with a `style` keeps its background, border and
    shadow.
- Web (`bun run build && bun run start`) at 390×844 and 1280×800:
  - The wide-row popover stays inside the viewport.
  - Tall content scrolls with the wheel.
  - An outside click closes it.
- Screenshots go under `/tmp/fleet/ui/expo-ui/popover/`.

## Out of scope

- DropdownMenu, Select and Tooltip placement: same primitive clamp, separate
  spec if needed.
- A trigger-aware outside overlay; mindmap's `SearchResultsPopover` exists for
  that.
- Web `collisionPadding`, which needs an rn-primitives change.
- Mindmap's migration: delete its workarounds after the release.

## Open questions

None.
