/**
 * Live component previews for the galleries.
 *
 * One entry per `COMPONENTS` id, keyed by that id. Kept out of `registry.ts`
 * on purpose: the registry stays serializable data (ids, import paths,
 * categories) that a script or a server route can read, while the JSX that
 * *renders* a component lives here. The alternative — a render function on each
 * registry entry — would make `registry.ts` a React module.
 *
 * Every preview is a real instance of the shipped component, not a mock: that's
 * the point of the gallery, and it means a component that regresses shows the
 * regression in the card. Previews are deliberately small and mostly
 * uncontrolled — a card is a glance, not a demo. The detail screen
 * (`ComponentDetailScreen.tsx`) shows the interactive variants.
 *
 * Components with no meaningful static preview (imperative APIs like `Alert`,
 * or overlays that only exist while open) render a small trigger or a static
 * stand-in instead. `PREVIEWS` is intentionally partial: a component with no
 * entry falls back to its import path in the gallery, so adding to the registry
 * never breaks a screen.
 */

import React from "react";
import { Pressable, View } from "react-native";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@mrmeg/expo-ui/components/Accordion";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { AudioPlayer } from "@mrmeg/expo-ui/components/AudioPlayer";
import { Avatar, AvatarGroup } from "@mrmeg/expo-ui/components/Avatar";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { BottomSheet } from "@mrmeg/expo-ui/components/BottomSheet";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { Carousel } from "@mrmeg/expo-ui/components/Carousel";
import { Checkbox } from "@mrmeg/expo-ui/components/Checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@mrmeg/expo-ui/components/Collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@mrmeg/expo-ui/components/Dialog";
import { Drawer } from "@mrmeg/expo-ui/components/Drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@mrmeg/expo-ui/components/DropdownMenu";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { IconButton } from "@mrmeg/expo-ui/components/IconButton";
import { Image, type ImageFit } from "@mrmeg/expo-ui/components/Image";
import { InputOTP } from "@mrmeg/expo-ui/components/InputOTP";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { Label } from "@mrmeg/expo-ui/components/Label";
import { MediaGrid } from "@mrmeg/expo-ui/components/MediaGrid";
import { MediaSelectionBar } from "@mrmeg/expo-ui/components/MediaSelectionBar";
import { MediaTile } from "@mrmeg/expo-ui/components/MediaTile";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@mrmeg/expo-ui/components/Popover";
import { Progress } from "@mrmeg/expo-ui/components/Progress";
import { RadioGroup, RadioGroupItem } from "@mrmeg/expo-ui/components/RadioGroup";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mrmeg/expo-ui/components/Select";
import { Separator } from "@mrmeg/expo-ui/components/Separator";
import { Skeleton, SkeletonText } from "@mrmeg/expo-ui/components/Skeleton";
import { Slider } from "@mrmeg/expo-ui/components/Slider";
import { StatCard } from "@mrmeg/expo-ui/components/StatCard";
import { CaptionText, MonoText, SansSerifText, SerifText } from "@mrmeg/expo-ui/components/StyledText";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { Tabs, TabsList, TabsTrigger } from "@mrmeg/expo-ui/components/Tabs";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { ThemeSelector } from "@mrmeg/expo-ui/components/ThemeSelector";
import { Toggle } from "@mrmeg/expo-ui/components/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@mrmeg/expo-ui/components/ToggleGroup";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mrmeg/expo-ui/components/Tooltip";
import { UploadQueue, type UploadQueueEntry } from "@mrmeg/expo-ui/components/UploadQueue";
import type { MediaViewerItem } from "@mrmeg/expo-ui/components/MediaViewer";
import { LazyMediaViewer } from "@/client/components/LazyMediaViewer";
import { LazyVideo } from "@/client/components/LazyVideo";
import { useKeySelection, withAlpha } from "@mrmeg/expo-ui/hooks";
import { palette, spacing } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** A row of previews that should wrap rather than overflow a narrow card. */
function Row({ children, gap = spacing.sm }: { children: React.ReactNode; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap, justifyContent: "center" }}>
      {children}
    </View>
  );
}

/** A stack of previews, used where a component reads better vertically. */
function Stack({ children, gap = spacing.xs }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ gap, alignSelf: "stretch" }}>{children}</View>;
}

/**
 * Local state for the fully-controlled toggles (`Checkbox`, `Switch`,
 * `Toggle`), which have no uncontrolled mode. Small wrappers rather than
 * hard-coded `checked` values so the preview actually responds to a tap — a
 * dead switch in a gallery reads as a broken switch.
 */
function CheckboxPreview({ label }: { label: string }) {
  const [checked, setChecked] = React.useState(true);
  return <Checkbox checked={checked} onCheckedChange={setChecked} label={label} />;
}

/** A parent box over two children: the dash (and "mixed") while only some are on. */
function CheckboxGroupPreview() {
  const [items, setItems] = React.useState({ photos: true, videos: false });
  const values = Object.values(items);
  const all = values.every(Boolean);
  const some = values.some(Boolean) && !all;
  return (
    <Stack gap={spacing.xs}>
      <Checkbox
        checked={all}
        indeterminate={some}
        onCheckedChange={(next) => setItems({ photos: next, videos: next })}
        label="All media"
      />
      <Checkbox checked={items.photos} onCheckedChange={(photos) => setItems((v) => ({ ...v, photos }))} label="Photos" />
      <Checkbox checked={items.videos} onCheckedChange={(videos) => setItems((v) => ({ ...v, videos }))} label="Videos" />
    </Stack>
  );
}

function SwitchPreview({ label, initial }: { label: string; initial: boolean }) {
  const [checked, setChecked] = React.useState(initial);
  // A bare switch has no visible text; outside an Item row it must be named.
  return <Switch checked={checked} onCheckedChange={setChecked} accessibilityLabel={label} />;
}

function TogglePreview({ icon, label, initial }: { icon: IconName; label: string; initial: boolean }) {
  const [pressed, setPressed] = React.useState(initial);
  return (
    <Toggle pressed={pressed} onPressedChange={setPressed} size="sm" iconOnly accessibilityLabel={label}>
      <Icon name={icon} size={14} color={pressed ? "foreground" : "mutedForeground"} />
    </Toggle>
  );
}

/**
 * The `Image` card: the five fits on one non-square picture, a focal-point
 * crop, a clamped 16:9 frame, `"auto"`, a placeholder and the error state. All
 * of it uses the Media Lab's bundled core fixtures, so nothing here loads over
 * the network except the deliberate failure.
 */
const LANDSCAPE = require("@/assets/media/landscape.jpg");
const PORTRAIT = require("@/assets/media/portrait.jpg");
const SQUARE = require("@/assets/media/square.jpg");
/** The sample hash from the blurhash project, which has a bright top and a dark bottom. */
const BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
const IMAGE_FITS: ImageFit[] = ["cover", "contain", "fill", "none", "scale-down"];

function Captioned({ caption, children, style }: { caption: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ alignItems: "center", gap: spacing.xxs }, style]}>
      {children}
      <CaptionText>{caption}</CaptionText>
    </View>
  );
}

function ImagePreview() {
  return (
    <Stack gap={spacing.md}>
      {/* A 16:9 picture in square frames: the fit decides what shows. */}
      <Row gap={spacing.sm}>
        {IMAGE_FITS.map((fit) => (
          <Captioned key={fit} caption={fit}>
            <Image source={LANDSCAPE} alt="" fit={fit} radius="sm" style={{ width: 52, height: 52 }} />
          </Captioned>
        ))}
      </Row>

      {/* Frames wider than 16:9 crop top and bottom, where the bars differ. */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {(["top", "bottom"] as const).map((position) => (
          <Captioned key={position} caption={`position="${position}"`} style={{ flex: 1 }}>
            <Image source={LANDSCAPE} alt="" aspectRatio="3:1" position={position} radius="sm" />
          </Captioned>
        ))}
      </View>

      <Captioned caption='aspectRatio="16:9" maxHeight={200}'>
        <Image source={LANDSCAPE} alt="Color bars" aspectRatio="16:9" maxHeight={200} radius="md" />
      </Captioned>

      <Row gap={spacing.md}>
        <Captioned caption='aspectRatio="auto"'>
          <View style={{ width: 72 }}>
            <Image source={PORTRAIT} alt="" aspectRatio="auto" radius="sm" />
          </View>
        </Captioned>
        <Captioned caption="blurhash placeholder">
          <Image source={SQUARE} alt="" placeholder={BLURHASH} transition={800} radius="sm" style={{ width: 72, height: 72 }} />
        </Captioned>
        <Captioned caption="error state">
          <Image source="https://example.invalid/missing.jpg" alt="" radius="sm" style={{ width: 72, height: 72 }} />
        </Captioned>
      </Row>
    </Stack>
  );
}

/**
 * The `AudioPlayer` card: a compact player on the bundled tone, a full player
 * with a title, subtitle and artwork, and a full player on a source that
 * cannot load, which lands in the unavailable state. Nothing here plays until
 * pressed, and the only network request is the deliberate failure.
 */
const TONE = require("@/assets/media/tone.m4a");

function AudioPlayerPreview() {
  return (
    <Stack gap={spacing.md}>
      <View style={{ gap: spacing.xxs }}>
        <AudioPlayer source={TONE} title="Tone" />
        <CaptionText>compact</CaptionText>
      </View>
      <View style={{ gap: spacing.xxs }}>
        <AudioPlayer variant="full" source={TONE} title="Morning tone" subtitle="Template sounds" artwork={SQUARE} showMute />
        <CaptionText>full: artwork, title, subtitle, speed</CaptionText>
      </View>
      <View style={{ gap: spacing.xxs }}>
        <AudioPlayer variant="full" source="https://example.invalid/missing.mp3" title="Missing episode" subtitle="Broken source" />
        <CaptionText>full, source that fails to load</CaptionText>
      </View>
    </Stack>
  );
}

/**
 * The `Video` card: custom and native controls on the bundled clip, a portrait
 * clip capped by `maxHeight`, `fit="cover"` in a square frame, and the error
 * state. The clips are the Media Lab's bundled core fixtures; only the
 * deliberate failure leaves the device.
 */
const LANDSCAPE_VIDEO = require("@/assets/media/landscape.mp4");
const PORTRAIT_VIDEO = require("@/assets/media/portrait.mp4");

function VideoPreview() {
  return (
    <Stack gap={spacing.md}>
      <Captioned caption='controls="custom", with a poster'>
        <LazyVideo
          source={LANDSCAPE_VIDEO}
          controls="custom"
          aspectRatio={{ width: 640, height: 360 }}
          poster={LANDSCAPE}
          radius="md"
          title="Color bars"
        />
      </Captioned>

      <Captioned caption='controls="native"'>
        <LazyVideo
          source={LANDSCAPE_VIDEO}
          controls="native"
          aspectRatio={{ width: 640, height: 360 }}
          poster={LANDSCAPE}
          radius="md"
          title="Color bars"
        />
      </Captioned>

      {/* Centered at its natural width, not stretched across the card. */}
      <Captioned caption='aspectRatio="9:16" maxHeight={320}'>
        <LazyVideo source={PORTRAIT_VIDEO} controls="custom" aspectRatio="9:16" maxHeight={320} radius="md" title="Portrait clip" />
      </Captioned>

      <Row gap={spacing.md}>
        <Captioned caption='fit="cover", 1:1'>
          <View style={{ width: 150 }}>
            <LazyVideo source={LANDSCAPE_VIDEO} controls="custom" fit="cover" aspectRatio={1} radius="md" title="Cropped to a square" />
          </View>
        </Captioned>
        <Captioned caption="error state">
          <View style={{ width: 150 }}>
            <LazyVideo source="https://example.invalid/missing.mp4" controls="custom" aspectRatio={1} radius="md" title="Missing clip" />
          </View>
        </Captioned>
      </Row>
    </Stack>
  );
}

/**
 * The `MediaViewer` card: a strip of three thumbnails (a picture and two clips,
 * each with its poster) that opens the viewer at the one tapped, so swiping
 * crosses between image and video. The same core fixtures as the cards above.
 */
const VIEWER_ITEMS: MediaViewerItem[] = [
  { type: "image", key: "landscape", source: LANDSCAPE, alt: "Color bars, landscape", title: "landscape.jpg" },
  { type: "video", key: "landscape-video", source: LANDSCAPE_VIDEO, poster: LANDSCAPE, title: "landscape.mp4" },
  { type: "video", key: "portrait-video", source: PORTRAIT_VIDEO, poster: PORTRAIT, title: "portrait.mp4" },
];

/** A translucent disc with a play glyph, centered over a poster: it says "video" without being a player. */
const PLAY_BADGE_LAYER = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
} as const;
const PLAY_BADGE = {
  width: 28,
  height: 28,
  borderRadius: spacing.radiusFull,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: withAlpha(palette.black, 0.45),
} as const;

function MediaViewerPreview() {
  const [open, setOpen] = React.useState<number | null>(null);
  const close = React.useCallback(() => setOpen(null), []);

  return (
    <Stack gap={spacing.md}>
      <Row gap={spacing.sm}>
        {VIEWER_ITEMS.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => setOpen(index)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
            testID={`viewer-thumb-${item.key}`}
          >
            <Image
              source={item.type === "image" ? item.source : (item.poster ?? null)}
              alt=""
              fit="cover"
              radius="md"
              style={{ width: 88, height: 88 }}
            />
            {item.type === "video" ? (
              <View style={PLAY_BADGE_LAYER}>
                <View style={PLAY_BADGE}>
                  <Icon name="play" size={14} color={palette.white} />
                </View>
              </View>
            ) : null}
          </Pressable>
        ))}
      </Row>
      <CaptionText style={{ textAlign: "center" }}>Tap one to open the viewer, then swipe, pinch or press ← →</CaptionText>
      <LazyMediaViewer items={VIEWER_ITEMS} visible={open !== null} initialIndex={open ?? 0} onClose={close} />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Media management: MediaTile, MediaGrid, MediaSelectionBar, UploadQueue
// ---------------------------------------------------------------------------

interface DemoMedia {
  id: string;
  title: string;
  subtitle: string;
  source: number;
}

/** Six stand-ins for a media library: the three bundled pictures, twice. */
function demoMedia(): DemoMedia[] {
  const pictures = [
    { name: "landscape", asset: LANDSCAPE },
    { name: "portrait", asset: PORTRAIT },
    { name: "square", asset: SQUARE },
  ];
  return [...pictures, ...pictures].map(({ name, asset }, index) => ({
    id: `${name}-${index}`,
    title: `${name}-${index + 1}.jpg`,
    subtitle: "240 KB",
    source: asset,
  }));
}

/**
 * The `MediaTile` card: a picture you can select and delete, and a clip whose
 * play button opens it. The delete chip only hides the tile; nothing is stored.
 */
function MediaTilePreview() {
  const [selected, setSelected] = React.useState(true);
  const [visible, setVisible] = React.useState(true);
  const [played, setPlayed] = React.useState(false);
  const toggle = React.useCallback(() => setSelected((value) => !value), []);
  const hide = React.useCallback(() => setVisible(false), []);
  const play = React.useCallback(() => setPlayed((value) => !value), []);

  return (
    <Stack gap={spacing.sm}>
      <Row gap={spacing.sm}>
        {visible ? (
          <MediaTile
            id="beach"
            kind="image"
            source={LANDSCAPE}
            size={72}
            title="beach.jpg"
            subtitle="1.2 MB"
            selected={selected}
            onToggleSelect={toggle}
            onDelete={hide}
            deleteIcon="trash"
          />
        ) : (
          <Button preset="outline" size="sm" text="Restore" onPress={() => setVisible(true)} />
        )}
        <MediaTile
          id="clip"
          kind="video"
          source={PORTRAIT}
          size={72}
          title="clip.mp4"
          subtitle={played ? "Playing" : "0:12"}
          onPress={play}
        />
      </Row>
    </Stack>
  );
}

/** The `MediaGrid` card: six tiles in as many columns as the card fits. Its own scrolling is off; the card scrolls. */
function MediaGridPreview() {
  const items = React.useMemo(demoMedia, []);
  const selection = useKeySelection(React.useMemo(() => items.map((item) => item.id), [items]));
  const { toggle, selected } = selection;

  return (
    <View style={{ alignSelf: "stretch" }}>
      <MediaGrid
        data={items}
        keyExtractor={(item) => item.id}
        extraData={selected}
        scrollEnabled={false}
        minTileWidth={56}
        gap={spacing.xs}
        rowGap={spacing.xs}
        renderTile={({ item, size }) => (
          <MediaTile
            id={item.id}
            kind="image"
            source={item.source}
            size={size}
            accessibilityLabel={item.title}
            selected={selected.has(item.id)}
            onPress={toggle}
          />
        )}
      />
    </View>
  );
}

/** The `MediaSelectionBar` card: select all, partial selection, Clear and a Delete that removes the selected rows. */
function MediaSelectionBarPreview() {
  const [keys, setKeys] = React.useState(() => ["a", "b", "c", "d", "e"]);
  const selection = useKeySelection(keys);
  const { selected, remove } = selection;
  const deleteSelected = React.useCallback(() => {
    const doomed = [...selected];
    setKeys((current) => current.filter((key) => !doomed.includes(key)));
    remove(doomed);
  }, [selected, remove]);

  return (
    <View style={{ alignSelf: "stretch" }}>
      <MediaSelectionBar
        selectedCount={selection.count}
        totalCount={keys.length}
        onToggleAll={selection.toggleAll}
        onClear={selection.clear}
        onDelete={deleteSelected}
        deleteIcon="trash"
      />
      {keys.length === 0 ? (
        <Button preset="outline" size="sm" text="Reset" onPress={() => setKeys(["a", "b", "c", "d", "e"])} style={{ alignSelf: "center", marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

/**
 * The `UploadQueue` card: a video converting at 42%, an upload with no known
 * progress, a file waiting, and a failure that retries. Retry re-queues the
 * entry and remove drops it; nothing is uploaded.
 */
const INITIAL_UPLOADS = (): UploadQueueEntry[] => [
  { id: "clip", fileName: "clip.mov", kind: "video", status: "processing", phase: "converting-video", progress: 0.42 },
  { id: "beach", fileName: "beach.heic", kind: "image", status: "uploading" },
  { id: "dusk", fileName: "dusk.jpg", kind: "image", status: "queued" },
  { id: "big", fileName: "big-scan.png", kind: "image", status: "failed", errorMessage: "File is too large" },
];

function UploadQueuePreview() {
  const [entries, setEntries] = React.useState(INITIAL_UPLOADS);
  const retry = React.useCallback(
    (id: string) =>
      setEntries((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, status: "queued", errorMessage: undefined } : entry)),
      ),
    [],
  );
  const remove = React.useCallback(
    (id: string) => setEntries((current) => current.filter((entry) => entry.id !== id)),
    [],
  );

  return entries.length > 0 ? (
    <View style={{ alignSelf: "stretch" }}>
      <UploadQueue entries={entries} onRetry={retry} onRemove={remove} kindIcons={{ image: "image", video: "video" }} testID="upload-queue-preview" />
    </View>
  ) : (
    <Button preset="outline" size="sm" text="Reset" onPress={() => setEntries(INITIAL_UPLOADS())} />
  );
}

// ---------------------------------------------------------------------------
// Preview map
// ---------------------------------------------------------------------------

/**
 * `id` → preview element factory.
 *
 * A factory rather than an element so each card mounts its own instance:
 * shared elements would share the uncontrolled state of interactive previews
 * (two `Switch` cards toggling as one).
 */
export const PREVIEWS: Record<string, () => React.ReactElement> = {
  // ── Form ────────────────────────────────────────────────────────────────
  Button: () => (
    <Row>
      <Button preset="default" size="sm" text="Continue" />
      <Button preset="outline" size="sm" text="Cancel" />
    </Row>
  ),

  // Every control is named: an icon-only button has no other accessible name.
  IconButton: () => (
    <Row gap={spacing.md}>
      <IconButton icon="settings" size="sm" preset="ghost" accessibilityLabel="Settings" />
      <IconButton icon="refresh-cw" size="md" preset="outline" accessibilityLabel="Refresh" />
      <IconButton icon="upload" size="lg" preset="default" accessibilityLabel="Upload" />
      <IconButton icon="heart" shape="circle" preset="outline" accessibilityLabel="Like" />
    </Row>
  ),

  Checkbox: () => (
    <Stack gap={spacing.md}>
      <CheckboxPreview label="Remember me" />
      <CheckboxGroupPreview />
    </Stack>
  ),

  InputOTP: () => <InputOTP value="42" onChangeText={() => {}} length={4} />,

  // Association needs two distinct ids: `nativeID` names the label, `htmlFor`
  // points at the input's `nativeID`. One shared value would render duplicate
  // ids on web and associate nothing.
  Label: () => (
    <Stack>
      <Label nativeID="preview-email-label" htmlFor="preview-email" required>Email</Label>
      <TextInput nativeID="preview-email" size="sm" placeholder="you@example.com" editable={false} />
    </Stack>
  ),

  RadioGroup: () => (
    <RadioGroup value="monthly" onValueChange={() => {}}>
      <RadioGroupItem value="monthly" label="Monthly" />
      <RadioGroupItem value="yearly" label="Yearly" />
    </RadioGroup>
  ),

  Select: () => (
    <Select>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Select a plan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="starter" label="Starter" />
        <SelectItem value="pro" label="Pro" />
      </SelectContent>
    </Select>
  ),

  Slider: () => <View style={{ alignSelf: "stretch" }}><Slider value={62} /></View>,

  ThemeSelector: () => (
    <View style={{ alignSelf: "stretch", alignItems: "center", gap: spacing.md }}>
      <Row>
        <ThemeSelector />
      </Row>
      <ThemeSelector showLabels />
    </View>
  ),

  Switch: () => (
    <Row>
      <SwitchPreview label="Notifications" initial />
      <SwitchPreview label="Dark mode" initial={false} />
    </Row>
  ),

  TextInput: () => (
    <TextInput size="sm" defaultValue="hello@terlo.app" editable={false} />
  ),

  Toggle: () => (
    <Row gap={spacing.xs}>
      <TogglePreview icon="letter-b" label="Bold" initial />
      <TogglePreview icon="italic" label="Italic" initial={false} />
      <TogglePreview icon="underline" label="Underline" initial={false} />
    </Row>
  ),

  // ToggleGroupItem renders its children inside a Pressable, so each label needs
  // its own Text — a bare string throws "Text strings must be rendered within a
  // <Text> component".
  ToggleGroup: () => (
    <ToggleGroup type="single" value="left" onValueChange={() => {}} size="sm">
      {(["Left", "Center", "Right"] as const).map((label) => (
        <ToggleGroupItem key={label} value={label.toLowerCase()}>
          <SansSerifText>{label}</SansSerifText>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),

  // ── Feedback ────────────────────────────────────────────────────────────
  // Alert is an imperative API (`Alert.show`), so the preview is the trigger.
  Alert: () => <Button preset="outline" size="sm" text="Show alert" />,

  Badge: () => (
    <Row gap={spacing.xs}>
      <Badge text="Active" />
      <Badge variant="secondary" text="Draft" />
      <Badge variant="destructive" text="Failed" />
    </Row>
  ),

  EmptyState: () => (
    <EmptyState icon="inbox" title="No results yet" description="Try a different search." />
  ),

  Progress: () => (
    <Stack gap={spacing.sm}>
      <Progress value={64} />
      <Progress value={32} variant="accent" size="sm" />
    </Stack>
  ),

  Skeleton: () => (
    <Row>
      <Skeleton width={36} height={36} circle />
      <View style={{ flex: 1, minWidth: 80 }}><SkeletonText lines={2} /></View>
    </Row>
  ),

  // ── Navigation ──────────────────────────────────────────────────────────
  // AccordionTrigger lays its children out next to the chevron inside a
  // Pressable, so the title has to be a Text element, not a bare string.
  Accordion: () => (
    <Accordion type="single" collapsible defaultValue="billing" style={{ alignSelf: "stretch" }}>
      <AccordionItem value="billing">
        <AccordionTrigger>
          <SansSerifText>How does billing work?</SansSerifText>
        </AccordionTrigger>
        <AccordionContent>
          <SansSerifText>Monthly or yearly, cancel anytime.</SansSerifText>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="cancel">
        <AccordionTrigger>
          <SansSerifText>Can I cancel anytime?</SansSerifText>
        </AccordionTrigger>
        <AccordionContent>
          <SansSerifText>Yes — from settings.</SansSerifText>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),

  Collapsible: () => (
    <Collapsible defaultOpen style={{ alignSelf: "stretch" }}>
      <CollapsibleTrigger>
        <Row gap={spacing.xs}>
          <SansSerifText>Advanced options</SansSerifText>
          <Icon name="chevron-up" size={14} color="mutedForeground" />
        </Row>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SkeletonText lines={2} />
      </CollapsibleContent>
    </Collapsible>
  ),

  SegmentedControl: () => (
    <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
      <SegmentedControl values={["List", "Grid", "Map"]} defaultValue="List" />
      <SegmentedControl size="lg" values={["List", "Grid", "Map"]} defaultValue="List" />
    </View>
  ),

  Tabs: () => (
    <Tabs value="day" onValueChange={() => {}} variant="pill" style={{ alignSelf: "stretch" }}>
      <TabsList>
        <TabsTrigger value="day"><TabsTrigger.Text>Day</TabsTrigger.Text></TabsTrigger>
        <TabsTrigger value="week"><TabsTrigger.Text>Week</TabsTrigger.Text></TabsTrigger>
        <TabsTrigger value="month"><TabsTrigger.Text>Month</TabsTrigger.Text></TabsTrigger>
      </TabsList>
    </Tabs>
  ),

  // ── Overlay ─────────────────────────────────────────────────────────────
  // Overlays have nothing to show until opened, so each preview is the real
  // trigger wired to the real overlay — tappable straight from the card.
  BottomSheet: () => (
    <BottomSheet>
      <BottomSheet.Trigger asChild>
        <Button preset="outline" size="sm" text="Open sheet" />
      </BottomSheet.Trigger>
      <BottomSheet.Content>
        <BottomSheet.Handle />
        <BottomSheet.Body>
          <SansSerifText>A native sheet on iOS and Android, a modal on web.</SansSerifText>
        </BottomSheet.Body>
      </BottomSheet.Content>
    </BottomSheet>
  ),

  Dialog: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button preset="outline" size="sm" text="Delete project" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),

  Drawer: () => (
    <Drawer side="left" width={260}>
      <Drawer.Trigger asChild>
        <Button preset="outline" size="sm" text="Open drawer" />
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <SansSerifText>Navigation</SansSerifText>
        </Drawer.Header>
        <Drawer.Body>
          <SkeletonText lines={3} />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  ),

  DropdownMenu: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button preset="outline" size="sm" text="Actions" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem><SansSerifText>Duplicate</SansSerifText></DropdownMenuItem>
        <DropdownMenuItem><SansSerifText>Rename</SansSerifText></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive"><SansSerifText>Delete</SansSerifText></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),

  Popover: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button preset="outline" size="sm" text="Filters" />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverBody>
          <SkeletonText lines={2} />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  ),

  Tooltip: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button preset="ghost" size="sm" text="Hover me" />
      </TooltipTrigger>
      <TooltipContent>
        <SansSerifText>Copy to clipboard</SansSerifText>
      </TooltipContent>
    </Tooltip>
  ),

  // ── Layout ──────────────────────────────────────────────────────────────
  AnimatedView: () => (
    <Row gap={spacing.xs}>
      {[0, 1, 2].map((index) => (
        <AnimatedView key={index} type="fadeSlideUp" delay={index * 120}>
          <Skeleton width={28} height={28} />
        </AnimatedView>
      ))}
    </Row>
  ),

  Avatar: () => (
    <AvatarGroup max={3} size="md">
      <Avatar name="Ada Lovelace" />
      <Avatar name="Grace Hopper" />
      <Avatar name="Alan Turing" />
      <Avatar name="Katherine Johnson" />
    </AvatarGroup>
  ),

  Card: () => (
    <Card style={{ alignSelf: "stretch" }}>
      <CardHeader>
        <CardTitle>Weekly report</CardTitle>
        <CardDescription>Updated 2h ago</CardDescription>
      </CardHeader>
      <CardContent>
        <SkeletonText lines={2} />
      </CardContent>
    </Card>
  ),

  Carousel: () => (
    <View style={{ alignSelf: "stretch" }}>
      <Carousel itemWidth={0.7} gap={spacing.sm} contentPadding={0} showDots={false}>
        {["Alpha", "Bravo", "Charlie"].map((label) => (
          <Card key={label}>
            <CardContent>
              <SansSerifText>{label}</SansSerifText>
            </CardContent>
          </Card>
        ))}
      </Carousel>
    </View>
  ),

  Item: () => (
    <View style={{ alignSelf: "stretch" }}>
      <ItemGroup>
        <Item>
          <ItemMedia icon="calendar" />
          <ItemContent>
            <ItemTitle>Design review</ItemTitle>
            <ItemDescription>Tomorrow · 10:00</ItemDescription>
          </ItemContent>
        </Item>
        <Item>
          <ItemMedia icon="bell" />
          <ItemContent>
            <ItemTitle>Standup</ItemTitle>
            <ItemDescription>Daily · 09:30</ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>
    </View>
  ),

  SectionHeader: () => (
    <View style={{ alignSelf: "stretch" }}>
      <SectionHeader eyebrow="Activity" title="Recent activity" description="The last seven days." />
    </View>
  ),

  Separator: () => (
    <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
      <Separator />
      <Separator variant="primary" size="lg" />
    </View>
  ),

  StatCard: () => (
    <View style={{ alignSelf: "stretch" }}>
      <StatCard
        label="Active users"
        value="2,481"
        change={{ value: "+8.2%", direction: "up" }}
      />
    </View>
  ),

  // ── Media ───────────────────────────────────────────────────────────────
  AudioPlayer: () => <AudioPlayerPreview />,
  Image: () => <ImagePreview />,
  Video: () => <VideoPreview />,
  MediaViewer: () => <MediaViewerPreview />,
  MediaTile: () => <MediaTilePreview />,
  MediaGrid: () => <MediaGridPreview />,
  MediaSelectionBar: () => <MediaSelectionBarPreview />,
  UploadQueue: () => <UploadQueuePreview />,

  // ── Typography ──────────────────────────────────────────────────────────
  Icon: () => (
    <Row gap={spacing.sm}>
      {(["heart", "star", "clock", "mail", "zap"] as const).map((name) => (
        <Icon key={name} name={name} size={20} color="foreground" />
      ))}
    </Row>
  ),

  StyledText: () => (
    <Stack>
      <SansSerifText fontWeight="semibold">Sans semibold</SansSerifText>
      <SerifText>Serif regular</SerifText>
      <MonoText size="sm">Mono 12</MonoText>
      <CaptionText>Caption</CaptionText>
    </Stack>
  ),
};

/** The preview element for a component id, or `null` when it has none. */
export function renderPreview(id: string): React.ReactElement | null {
  const factory = PREVIEWS[id];
  return factory ? factory() : null;
}
