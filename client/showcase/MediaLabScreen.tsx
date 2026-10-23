import React, { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Badge, type BadgeProps } from "@mrmeg/expo-ui/components/Badge";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@mrmeg/expo-ui/components/Item";
import { Screen } from "@mrmeg/expo-ui/components/Screen";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mrmeg/expo-ui/components/Select";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import { GalleryChips, type GalleryChip } from "./GalleryChips";
import { ALL_CATEGORIES, type CategoryFilter } from "./filters";
import { ImageSection } from "./MediaLabImages";
import { ThemeToggle } from "./ThemeToggle";
import {
  FIXTURE_SURFACES,
  MEDIA_FIXTURES,
  resolveFixtureUri,
  type FixtureCategory,
  type FixtureTier,
  type MediaFixture,
  type Observed,
  type Surface,
} from "./mediaFixtures";

/**
 * Media Lab
 *
 * Checks `Image`, `Video`, `AudioPlayer` and `MediaViewer` against every case
 * a real app meets, not three happy-path samples. It lists every fixture in
 * `mediaFixtures.ts` with its availability, and holds one set of playground
 * controls that every section receives.
 *
 * Each component spec fills its own slot in {@link renderers} (`media-image`
 * is in; `media-video`, `media-audio` and `media-viewer` are pending); a section
 * with no renderer shows a pending line.
 *
 * Availability is checked client-side after mount (HEAD, 5 s timeout, at most
 * six in flight). A fixture that is not available is never handed to a
 * renderer: a missing file and an intentionally broken one must not look alike.
 */

// ---------------------------------------------------------------------------
// Playground state
// ---------------------------------------------------------------------------

export type ImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";
export type ImagePosition = "center" | "top" | "bottom" | "left" | "right";
/** `ratio`: explicit aspect ratio; `auto`: natural ratio after load; `fill`: fill a fixed box; `style`: sized by style. */
export type ImageSizing = "ratio" | "auto" | "fill" | "style";
export type RadiusKey = "none" | "sm" | "md" | "lg";
export type VideoControlsMode = "native" | "custom" | "none";
export type VideoFit = "contain" | "cover" | "fill";
export type AudioVariant = "compact" | "full";
export type WidthPreset = "full" | 375 | 768 | 1280;

export interface PlaygroundState {
  imageFit: ImageFit;
  imagePosition: ImagePosition;
  imageSizing: ImageSizing;
  maxHeight: boolean;
  radius: RadiusKey;
  videoControls: VideoControlsMode;
  videoFit: VideoFit;
  autoplayMuted: boolean;
  loop: boolean;
  poster: boolean;
  audioVariant: AudioVariant;
  width: WidthPreset;
}

export const DEFAULT_PLAYGROUND: PlaygroundState = {
  imageFit: "cover",
  imagePosition: "center",
  imageSizing: "ratio",
  maxHeight: false,
  radius: "md",
  videoControls: "native",
  videoFit: "contain",
  autoplayMuted: false,
  loop: false,
  poster: true,
  audioVariant: "compact",
  width: "full",
};

/** `PlaygroundState.radius` as a pixel value from the radius scale. */
export const RADIUS_VALUES: Record<RadiusKey, number> = {
  none: spacing.radiusNone,
  sm: spacing.radiusSm,
  md: spacing.radiusMd,
  lg: spacing.radiusLg,
};

const IMAGE_FITS: ImageFit[] = ["cover", "contain", "fill", "none", "scale-down"];
const IMAGE_POSITIONS: ImagePosition[] = ["center", "top", "bottom", "left", "right"];

type Choice<T> = { value: T; label: string };

const SIZING_CHOICES: Choice<ImageSizing>[] = [
  { value: "ratio", label: "Ratio" },
  { value: "auto", label: "Auto" },
  { value: "fill", label: "Fill" },
  { value: "style", label: "Style" },
];
const RADIUS_CHOICES: Choice<RadiusKey>[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "SM" },
  { value: "md", label: "MD" },
  { value: "lg", label: "LG" },
];
const CONTROLS_CHOICES: Choice<VideoControlsMode>[] = [
  { value: "native", label: "Native" },
  { value: "custom", label: "Custom" },
  { value: "none", label: "None" },
];
const VIDEO_FIT_CHOICES: Choice<VideoFit>[] = [
  { value: "contain", label: "Contain" },
  { value: "cover", label: "Cover" },
  { value: "fill", label: "Fill" },
];
const VARIANT_CHOICES: Choice<AudioVariant>[] = [
  { value: "compact", label: "Compact" },
  { value: "full", label: "Full" },
];
const WIDTH_CHOICES: Choice<WidthPreset>[] = [
  { value: "full", label: "Full" },
  { value: 375, label: "375" },
  { value: 768, label: "768" },
  { value: 1280, label: "1280" },
];

type PlaygroundAction = {
  [K in keyof PlaygroundState]: { key: K; value: PlaygroundState[K] };
}[keyof PlaygroundState];

function playgroundReducer(state: PlaygroundState, action: PlaygroundAction): PlaygroundState {
  return { ...state, [action.key]: action.value };
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/**
 * `checking` is the moment before the HEAD check answers; the other four are
 * the states a fixture settles into, and each reads differently on screen.
 */
export type Availability = "checking" | "available" | "not-generated" | "unreachable" | "no-origin";

interface AvailabilityLook {
  label: string;
  icon: IconName;
  color: "mutedForeground" | "success" | "warning" | "destructive";
}

export const AVAILABILITY_LOOKS: Record<Availability, AvailabilityLook> = {
  checking: { label: "checking", icon: "clock", color: "mutedForeground" },
  available: { label: "available", icon: "circle-check-big", color: "success" },
  "not-generated": { label: "not generated", icon: "download", color: "warning" },
  unreachable: { label: "unreachable", icon: "cloud-off", color: "destructive" },
  "no-origin": { label: "no origin", icon: "circle-question-mark", color: "mutedForeground" },
};

export const GENERATE_HINT = "run `bun run media:fixtures`";

const PROBE_TIMEOUT_MS = 5000;
const MAX_IN_FLIGHT = 6;
const FLUSH_DELAY_MS = 80;

type ProbeResult = "available" | "not-generated" | "unreachable";

const isHtml = (response: Response) => (response.headers?.get?.("content-type") ?? "").toLowerCase().includes("text/html");

/**
 * Check one URL. Generated fixtures are same-origin files, so a HEAD answer
 * decides: 2xx that is not an HTML page means built, anything else means the
 * generator has not run (an unknown path can fall through to the router and
 * come back as HTML). Remote streams are fussier: some CDNs refuse HEAD, so a
 * refused or failed HEAD falls back to a one-byte ranged GET (aborted once the
 * headers arrive; the live MP3 never ends), and on web a last `no-cors` GET
 * treats an opaque response as reachable.
 */
export async function probeUrl(url: string, remote: boolean, timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { signal } = controller;

  try {
    let headOutcome: "refused" | "threw";
    try {
      const head = await fetch(url, { method: "HEAD", signal });
      if (head.ok) {
        if (!remote && isHtml(head)) return "not-generated";
        return "available";
      }
      if (!remote) return "not-generated";
      headOutcome = "refused";
    } catch {
      if (!remote) return "unreachable";
      headOutcome = "threw";
    }

    try {
      const ranged = await fetch(url, { headers: { Range: "bytes=0-0" }, signal });
      if (ranged.ok) return "available";
      return "unreachable";
    } catch {
      if (headOutcome === "threw" && Platform.OS === "web" && !signal.aborted) {
        try {
          await fetch(url, { mode: "no-cors", signal });
          return "available";
        } catch {
          return "unreachable";
        }
      }
      return "unreachable";
    }
  } finally {
    clearTimeout(timer);
    // Stops a body that never ends (live audio) once the verdict is in.
    controller.abort();
  }
}

/** What a fixture shows before any network check: some answers need none. */
export function baseAvailability(fixture: MediaFixture): Availability {
  if (resolveFixtureUri(fixture) === null) return "no-origin";
  if (fixture.tier === "core" || fixture.intentionallyMissing) return "available";
  return "checking";
}

/**
 * HEAD-check every generated and remote fixture once, after mount, with at
 * most {@link MAX_IN_FLIGHT} in flight. Results are flushed in small batches so
 * a hundred answers do not cause a hundred renders.
 */
function useProbedAvailability(): Record<string, ProbeResult> {
  const [probed, setProbed] = useState<Record<string, ProbeResult>>({});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: Record<string, ProbeResult> = {};

    const flush = () => {
      timer = null;
      if (cancelled) return;
      const batch = pending;
      pending = {};
      setProbed((previous) => ({ ...previous, ...batch }));
    };
    const record = (id: string, result: ProbeResult) => {
      pending[id] = result;
      if (timer === null) timer = setTimeout(flush, FLUSH_DELAY_MS);
    };

    const queue = MEDIA_FIXTURES.filter((fixture) => baseAvailability(fixture) === "checking");
    let next = 0;
    const worker = async () => {
      while (!cancelled && next < queue.length) {
        const fixture = queue[next];
        next += 1;
        const uri = resolveFixtureUri(fixture);
        if (typeof uri !== "string") continue;
        const result = await probeUrl(uri, fixture.tier === "remote");
        if (!cancelled) record(fixture.id, result);
      }
    };
    for (let i = 0; i < Math.min(MAX_IN_FLIGHT, queue.length); i += 1) void worker();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  return probed;
}

// ---------------------------------------------------------------------------
// Sections and entries
// ---------------------------------------------------------------------------

export type SectionId = "image" | "video" | "audio" | "viewer";

/** One fixture as the lab resolved it: where it loads from and whether it can. */
export interface LabEntry {
  fixture: MediaFixture;
  availability: Availability;
  /** `null` when native has no origin to load generated fixtures from. */
  uri: string | number | null;
}

export interface SourceKindEntry {
  id: "bundled" | "public" | "remote" | "data-uri" | "picked";
  label: string;
  uri: string | number | null;
}

export interface SectionRendererProps {
  section: SectionId;
  /**
   * The section's fixtures after its filter chips, limited to those that can
   * be rendered: available, so a missing file never reaches a component.
   */
  entries: LabEntry[];
  /** The same filtered set that cannot be rendered (not generated, unreachable, no origin, still checking). */
  unavailable: LabEntry[];
  /**
   * Every fixture in the manifest as the lab resolved it, unfiltered and of
   * any kind, available or not. The viewer's scale preset reads from here: its
   * own `entries` leave the 60 list-scale thumbnails out.
   */
  allEntries: LabEntry[];
  /**
   * Each section's current filter result, renderable fixtures only, so the
   * viewer can "open the current filter as a set" for the Images or Video
   * section the user has narrowed.
   */
  filtered: Record<SectionId, LabEntry[]>;
  /** One state object shared by every section. */
  playground: PlaygroundState;
  /** Bundled, public path, remote HTTPS, data URI, and the picked `file://` URI when there is one. */
  sourceKinds: SourceKindEntry[];
}

export type SectionRenderer = React.ComponentType<SectionRendererProps>;
export type LabRenderers = Partial<Record<SectionId, SectionRenderer>>;

/**
 * The slot map the component specs fill: `media-image` sets `image` (see
 * `MediaLabImages.tsx`), `media-video` sets `video`, `media-audio` sets
 * `audio`, `media-viewer` sets `viewer`. Each is a component receiving
 * {@link SectionRendererProps}.
 */
export const renderers: LabRenderers = { image: ImageSection };

interface SectionDef {
  id: SectionId;
  title: string;
  description: string;
  /** The spec that fills this section's renderer slot. */
  spec: string;
  include: (fixture: MediaFixture) => boolean;
}

const SECTIONS: SectionDef[] = [
  {
    id: "image",
    title: "Images",
    description: "Aspect and size, formats, orientation, color, responsive sources, list scale and broken files.",
    spec: "media-image",
    include: (fixture) => fixture.kind === "image",
  },
  {
    id: "video",
    title: "Video",
    description: "Aspect, rotation, tracks, duration, codecs, containers, streams, live and captions.",
    spec: "media-video",
    include: (fixture) => fixture.kind === "video",
  },
  {
    id: "audio",
    title: "Audio",
    description: "Formats, durations past an hour, channels, metadata, live and broken files.",
    spec: "media-audio",
    include: (fixture) => fixture.kind === "audio",
  },
  {
    id: "viewer",
    title: "Viewer",
    description: "The images and videos a gallery viewer opens as a set. The 60-thumbnail scale set is its own preset.",
    spec: "media-viewer",
    include: (fixture) => fixture.kind !== "audio" && fixture.category !== "scale",
  },
];

const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  aspect: "Aspect",
  format: "Format",
  codec: "Codec",
  orientation: "Orientation",
  color: "Color",
  duration: "Duration",
  tracks: "Tracks",
  container: "Container",
  stream: "Stream",
  live: "Live",
  captions: "Captions",
  source: "Source",
  scale: "Scale",
  broken: "Broken",
};

const TIER_LABELS: Record<FixtureTier, string> = { core: "Core", generated: "Generated", remote: "Remote" };
const TIERS: FixtureTier[] = ["core", "generated", "remote"];

const SURFACE_LABELS: Record<Surface, string> = {
  ios: "iOS",
  android: "Android",
  "web-chrome": "Chrome",
  "web-safari": "Safari",
  "web-firefox": "Firefox",
};

const OBSERVED_VARIANTS: Record<Observed, BadgeProps["variant"]> = {
  works: "default",
  partial: "secondary",
  fails: "destructive",
  unverified: "outline",
};

interface SectionFilter {
  category: CategoryFilter<FixtureCategory>;
  tier: CategoryFilter<FixtureTier>;
  errors: CategoryFilter<"errors">;
}

const NO_FILTER: SectionFilter = { category: ALL_CATEGORIES, tier: ALL_CATEGORIES, errors: ALL_CATEGORIES };

function applyFilter(entries: LabEntry[], filter: SectionFilter): LabEntry[] {
  return entries.filter(({ fixture }) => {
    if (filter.category !== ALL_CATEGORIES && fixture.category !== filter.category) return false;
    if (filter.tier !== ALL_CATEGORIES && fixture.tier !== filter.tier) return false;
    if (filter.errors !== ALL_CATEGORIES && !fixture.expectError) return false;
    return true;
  });
}

function countBy<T extends string>(entries: LabEntry[], pick: (fixture: MediaFixture) => T): Map<T, number> {
  const counts = new Map<T, number>();
  for (const { fixture } of entries) counts.set(pick(fixture), (counts.get(pick(fixture)) ?? 0) + 1);
  return counts;
}

function chipsFor<T extends string>(
  entries: LabEntry[],
  order: readonly T[],
  labels: Record<T, string>,
  pick: (fixture: MediaFixture) => T,
  allLabel: string,
): GalleryChip<T>[] {
  const counts = countBy(entries, pick);
  return [
    { value: ALL_CATEGORIES, label: allLabel, count: entries.length },
    ...order.filter((value) => (counts.get(value) ?? 0) > 0).map((value) => ({ value, label: labels[value], count: counts.get(value) })),
  ];
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as FixtureCategory[];

function formatDuration(seconds: number): string {
  if (seconds < 60 && !Number.isInteger(seconds)) return `${seconds} s`;
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function describeFixture(fixture: MediaFixture): string {
  const parts: string[] = [`${fixture.kind} · ${fixture.tier} · ${fixture.category}`];
  if (fixture.width && fixture.height) parts.push(`${fixture.width}×${fixture.height}`);
  if (fixture.durationSec !== undefined) parts.push(formatDuration(fixture.durationSec));
  return parts.join(" · ");
}

function shortUri(uri: string | number | null): string {
  if (uri === null) return "no origin";
  // A require()d asset is a module id (a number; Jest's transform can make it an object).
  if (typeof uri !== "string") return "bundled asset, resolved through require()";
  return uri.length > 76 ? `${uri.slice(0, 73)}…` : uri;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

/**
 * One availability state: an icon, a label and a color that differ per state,
 * plus the generator hint under `not generated`. Exported for tests.
 */
export function AvailabilityTag({ state }: { state: Availability }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const look = AVAILABILITY_LOOKS[state];
  const color = theme.colors[look.color];

  return (
    <View style={styles.tagColumn} testID={`availability-${state}`}>
      <View style={styles.tagRow}>
        <Icon name={look.icon} size={spacing.iconSm} color={look.color} />
        <StyledText semantic="caption" fontWeight="medium" style={{ color }}>
          {look.label}
        </StyledText>
      </View>
      {state === "not-generated" ? (
        <StyledText semantic="caption" variant="mono" style={styles.dim}>
          {GENERATE_HINT}
        </StyledText>
      ) : null}
    </View>
  );
}

// `fixture` is a stable module object and `availability` a string, so a probe
// flush re-renders only the rows whose state changed (a `LabEntry` is rebuilt
// on every flush and would defeat the memo).
const FixtureRow = memo(function FixtureRow({ fixture, availability }: { fixture: MediaFixture; availability: Availability }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <Item testID={`fixture-${fixture.id}`}>
      <ItemContent>
        <ItemTitle>{fixture.label}</ItemTitle>
        <ItemDescription>{describeFixture(fixture)}</ItemDescription>
        {fixture.note ? <ItemDescription>{fixture.note}</ItemDescription> : null}
        <View style={styles.statusRow}>
          <AvailabilityTag state={availability} />
          {fixture.expectError ? <Badge variant="secondary" text="expects error" /> : null}
        </View>
        <ObservedStatus fixture={fixture} />
      </ItemContent>
    </Item>
  );
});

/**
 * What was observed for a fixture, per surface. Chips only for surfaces a PR
 * actually tested; untested surfaces collapse into one muted line, so a list
 * of 200 fixtures with nothing verified yet doesn't carry 1,000 chips.
 */
export function ObservedStatus({ fixture }: { fixture: MediaFixture }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const verified = FIXTURE_SURFACES.filter((surface) => (fixture.observed[surface] ?? "unverified") !== "unverified");
  const untested = FIXTURE_SURFACES.filter((surface) => !verified.includes(surface));

  if (verified.length === 0) {
    return <ItemDescription testID={`observed-${fixture.id}`}>Not verified on any surface yet</ItemDescription>;
  }

  return (
    <View testID={`observed-${fixture.id}`} style={styles.badgeRow}>
      {verified.map((surface) => {
        const observed = fixture.observed[surface] as Observed;
        return <Badge key={surface} variant={OBSERVED_VARIANTS[observed]} text={`${SURFACE_LABELS[surface]} ${observed}`} />;
      })}
      {untested.length > 0 ? (
        <ItemDescription>{`Unverified: ${untested.map((surface) => SURFACE_LABELS[surface]).join(", ")}`}</ItemDescription>
      ) : null}
    </View>
  );
}

interface ChoiceRowProps<T extends string | number> {
  title: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  testID: string;
}

/** A playground row: title over a `SegmentedControl` over a few choices. */
function ChoiceRow<T extends string | number>({ title, choices, value, onChange, testID }: ChoiceRowProps<T>) {
  const current = choices.find((choice) => choice.value === value) ?? choices[0];
  return (
    <Item testID={testID}>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <SegmentedControl
          values={choices.map((choice) => choice.label)}
          value={current.label}
          onValueChange={(label) => {
            const next = choices.find((choice) => choice.label === label);
            if (next) onChange(next.value);
          }}
        />
      </ItemContent>
    </Item>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
  testID,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <Item testID={testID}>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      <ItemActions>
        <Switch checked={checked} onCheckedChange={onChange} />
      </ItemActions>
    </Item>
  );
}

function SelectRow<T extends string>({
  title,
  options,
  value,
  onChange,
  testID,
}: {
  title: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  testID: string;
}) {
  return (
    <Item testID={testID}>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
      </ItemContent>
      <ItemActions>
        <Select value={{ value, label: value }} onValueChange={(option) => option && onChange(option.value as T)}>
          <SelectTrigger size="sm" accessibilityLabel={title}>
            <SelectValue placeholder={value} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option} label={option} />
            ))}
          </SelectContent>
        </Select>
      </ItemActions>
    </Item>
  );
}

function Playground({
  state,
  set,
}: {
  state: PlaygroundState;
  set: <K extends keyof PlaygroundState>(key: K, value: PlaygroundState[K]) => void;
}) {
  return (
    <ItemGroup
      title="Playground"
      description="One state for every section below. Width presets simulate breakpoints in this window."
      testID="media-lab-playground"
    >
      <SelectRow title="Image fit" options={IMAGE_FITS} value={state.imageFit} onChange={(v) => set("imageFit", v)} testID="playground-image-fit" />
      <SelectRow
        title="Image position"
        options={IMAGE_POSITIONS}
        value={state.imagePosition}
        onChange={(v) => set("imagePosition", v)}
        testID="playground-image-position"
      />
      <ChoiceRow title="Image sizing" choices={SIZING_CHOICES} value={state.imageSizing} onChange={(v) => set("imageSizing", v)} testID="playground-sizing" />
      <SwitchRow title="Max height" description="Cap tall images" checked={state.maxHeight} onChange={(v) => set("maxHeight", v)} testID="playground-max-height" />
      <ChoiceRow title="Radius" choices={RADIUS_CHOICES} value={state.radius} onChange={(v) => set("radius", v)} testID="playground-radius" />
      <ChoiceRow title="Video controls" choices={CONTROLS_CHOICES} value={state.videoControls} onChange={(v) => set("videoControls", v)} testID="playground-video-controls" />
      <ChoiceRow title="Video fit" choices={VIDEO_FIT_CHOICES} value={state.videoFit} onChange={(v) => set("videoFit", v)} testID="playground-video-fit" />
      <SwitchRow title="Autoplay, muted" checked={state.autoplayMuted} onChange={(v) => set("autoplayMuted", v)} testID="playground-autoplay" />
      <SwitchRow title="Loop" checked={state.loop} onChange={(v) => set("loop", v)} testID="playground-loop" />
      <SwitchRow title="Poster" checked={state.poster} onChange={(v) => set("poster", v)} testID="playground-poster" />
      <ChoiceRow title="Audio variant" choices={VARIANT_CHOICES} value={state.audioVariant} onChange={(v) => set("audioVariant", v)} testID="playground-audio-variant" />
      <ChoiceRow title="Container width" choices={WIDTH_CHOICES} value={state.width} onChange={(v) => set("width", v)} testID="playground-width" />
      <Item testID="playground-theme">
        <ItemContent>
          <ThemeToggle />
        </ItemContent>
      </Item>
    </ItemGroup>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

interface LabSectionProps {
  def: SectionDef;
  entries: LabEntry[];
  allEntries: LabEntry[];
  filtered: Record<SectionId, LabEntry[]>;
  filter: SectionFilter;
  onFilter: (next: SectionFilter) => void;
  playground: PlaygroundState;
  sourceKinds: SourceKindEntry[];
  pickedUri: string | null;
}

function LabSection({ def, entries, allEntries, filtered, filter, onFilter, playground, sourceKinds, pickedUri }: LabSectionProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const Renderer = renderers[def.id];

  const shown = useMemo(() => applyFilter(entries, filter), [entries, filter]);
  const renderable = useMemo(() => shown.filter((entry) => entry.availability === "available"), [shown]);
  const unavailable = useMemo(() => shown.filter((entry) => entry.availability !== "available"), [shown]);

  const categoryChips = useMemo(() => chipsFor(entries, CATEGORY_ORDER, CATEGORY_LABELS, (f) => f.category, "All"), [entries]);
  const tierChips = useMemo(() => chipsFor(entries, TIERS, TIER_LABELS, (f) => f.tier, "All"), [entries]);
  const errorChips = useMemo<GalleryChip<"errors">[]>(
    () => [
      { value: ALL_CATEGORIES, label: "All", count: entries.length },
      { value: "errors", label: "Expected errors", count: entries.filter((e) => e.fixture.expectError).length },
    ],
    [entries],
  );

  const availableCount = entries.filter((entry) => entry.availability === "available").length;

  return (
    <View style={styles.section} testID={`section-${def.id}`}>
      <View style={[styles.gutter, styles.sectionHeader]}>
        <StyledText semantic="heading" accessibilityRole="header">{def.title}</StyledText>
        <StyledText semantic="caption" style={styles.dim}>{def.description}</StyledText>
        <StyledText semantic="caption" style={styles.dim} testID={`section-${def.id}-count`}>
          {`${shown.length} of ${entries.length} fixtures shown, ${availableCount} available`}
        </StyledText>
      </View>

      <View style={[styles.gutter, styles.chips]}>
        <GalleryChips
          chips={categoryChips}
          selected={filter.category}
          onSelect={(category) => onFilter({ ...filter, category })}
          label={`Filter ${def.title} by category`}
          testID={`${def.id}-category`}
        />
        <GalleryChips
          chips={tierChips}
          selected={filter.tier}
          onSelect={(tier) => onFilter({ ...filter, tier })}
          label={`Filter ${def.title} by tier`}
          testID={`${def.id}-tier`}
        />
        <GalleryChips
          chips={errorChips}
          selected={filter.errors}
          onSelect={(errors) => onFilter({ ...filter, errors })}
          label={`Show only expected errors in ${def.title}`}
          testID={`${def.id}-errors`}
        />
      </View>

      {Renderer ? (
        <Renderer
          section={def.id}
          entries={renderable}
          unavailable={unavailable}
          allEntries={allEntries}
          filtered={filtered}
          playground={playground}
          sourceKinds={sourceKinds}
        />
      ) : (
        <View style={styles.gutter}>
          <StyledText semantic="caption" style={styles.dim} testID={`pending-${def.id}`}>
            {`Component arrives with spec ${def.spec}`}
          </StyledText>
        </View>
      )}

      {pickedUri ? (
        <ItemGroup>
          <Item testID={`picked-${def.id}`}>
            <ItemContent>
              <ItemTitle>Picked from library</ItemTitle>
              <ItemDescription>{pickedUri}</ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
      ) : null}

      <ItemGroup testID={`list-${def.id}`}>
        {shown.map((entry) => (
          <FixtureRow key={entry.fixture.id} fixture={entry.fixture} availability={entry.availability} />
        ))}
      </ItemGroup>
      {shown.length === 0 ? (
        <View style={styles.gutter}>
          <StyledText semantic="caption" style={styles.dim}>No fixtures match these filters.</StyledText>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Source kinds
// ---------------------------------------------------------------------------

const fixtureById = (id: string) => MEDIA_FIXTURES.find((fixture) => fixture.id === id);

function buildSourceKinds(picked: string | null): SourceKindEntry[] {
  const pick = (id: string) => {
    const fixture = fixtureById(id);
    return fixture ? resolveFixtureUri(fixture) : null;
  };
  const kinds: SourceKindEntry[] = [
    { id: "bundled", label: "Bundled require()", uri: pick("core-landscape") },
    { id: "public", label: "Public path", uri: pick("img-aspect-4x3") },
    { id: "remote", label: "Remote HTTPS", uri: pick("src-remote-png") },
    { id: "data-uri", label: "Data URI", uri: pick("src-data-uri") },
  ];
  if (picked) kinds.push({ id: "picked", label: "Picked from library", uri: picked });
  return kinds;
}

function SourceKinds({
  sourceKinds,
  onPick,
  pickError,
}: {
  sourceKinds: SourceKindEntry[];
  onPick: () => void;
  pickError: string | null;
}) {
  return (
    <ItemGroup
      title="Source kinds"
      description="How a component receives its media. The picked file shows in the Images or Video section."
      testID="media-lab-source-kinds"
    >
      {sourceKinds.map((kind) => (
        <Item key={kind.id} testID={`source-kind-${kind.id}`}>
          <ItemContent>
            <ItemTitle>{kind.label}</ItemTitle>
            <ItemDescription>{shortUri(kind.uri)}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
      <Item
        onPress={onPick}
        testID="source-kind-pick"
        accessibilityLabel="Pick from library"
        accessibilityHint="Opens the photo library and shows the picked file in the matching section"
      >
        <ItemContent>
          <ItemTitle>Pick from library</ItemTitle>
          <ItemDescription>{pickError ?? "Opens the photo library: the file:// URI appears in the matching section"}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Icon name="chevron-right" size={spacing.iconSm} color="mutedForeground" />
        </ItemActions>
      </Item>
      <Item
        onPress={() => router.push("/(main)/(tabs)/media")}
        testID="source-kind-signed"
        accessibilityLabel="Signed URLs in the media tab"
      >
        <ItemContent>
          <ItemTitle>Signed URLs</ItemTitle>
          <ItemDescription>Upload in the media tab, then open a signed URL</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Icon name="chevron-right" size={spacing.iconSm} color="mutedForeground" />
        </ItemActions>
      </Item>
    </ItemGroup>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type Picked = { image?: string; video?: string };

export default function MediaLabScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  const [playground, dispatch] = useReducer(playgroundReducer, DEFAULT_PLAYGROUND);
  const setPlayground = useCallback(
    <K extends keyof PlaygroundState>(key: K, value: PlaygroundState[K]) =>
      dispatch({ key, value } as PlaygroundAction),
    [],
  );

  const probed = useProbedAvailability();
  const allEntries = useMemo<LabEntry[]>(
    () =>
      MEDIA_FIXTURES.map((fixture) => {
        const base = baseAvailability(fixture);
        return {
          fixture,
          availability: base === "checking" ? (probed[fixture.id] ?? "checking") : base,
          uri: resolveFixtureUri(fixture),
        };
      }),
    [probed],
  );

  const [filters, setFilters] = useState<Record<SectionId, SectionFilter>>({
    image: NO_FILTER,
    video: NO_FILTER,
    audio: NO_FILTER,
    viewer: NO_FILTER,
  });

  const sectionEntries = useMemo(
    () => Object.fromEntries(SECTIONS.map((def) => [def.id, allEntries.filter((entry) => def.include(entry.fixture))])) as Record<SectionId, LabEntry[]>,
    [allEntries],
  );
  const filtered = useMemo(
    () =>
      Object.fromEntries(
        SECTIONS.map((def) => [
          def.id,
          applyFilter(sectionEntries[def.id], filters[def.id]).filter((entry) => entry.availability === "available"),
        ]),
      ) as Record<SectionId, LabEntry[]>,
    [sectionEntries, filters],
  );

  const [picked, setPicked] = useState<Picked>({});
  const [pickError, setPickError] = useState<string | null>(null);
  const pickedRef = useRef(false);
  const pickFromLibrary = useCallback(async () => {
    if (pickedRef.current) return;
    pickedRef.current = true;
    setPickError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 1 });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (asset) setPicked((previous) => ({ ...previous, [asset.type === "video" ? "video" : "image"]: asset.uri }));
    } catch (error) {
      setPickError(error instanceof Error ? error.message : "Could not open the library");
    } finally {
      pickedRef.current = false;
    }
  }, []);

  const pickedFor = (id: SectionId): string | null =>
    id === "image" ? (picked.image ?? null) : id === "video" ? (picked.video ?? null) : id === "viewer" ? (picked.image ?? picked.video ?? null) : null;

  const stage =
    playground.width === "full"
      ? styles.stage
      : [styles.stage, { maxWidth: playground.width, alignSelf: "center" as const }];

  return (
    <Screen edges={["bottom"]} scroll padded={false} contentContainerStyle={styles.content}>
      <View style={styles.chrome}>
        <View style={[styles.gutter, styles.header]}>
          <SectionHeader
            eyebrow="Media Lab"
            title="Every media case on one screen"
            description="A test corpus for Image, Video, AudioPlayer and MediaViewer: aspect ratios, formats, codecs, rotation, long durations, broken files and list-scale sets. Generated fixtures need `bun run media:fixtures`."
          />
        </View>
        <Playground state={playground} set={setPlayground} />
        <SourceKinds sourceKinds={buildSourceKinds(pickedFor("image") ?? pickedFor("video"))} onPick={pickFromLibrary} pickError={pickError} />
      </View>

      <View style={stage} testID="media-lab-stage">
        {SECTIONS.map((def) => (
          <LabSection
            key={def.id}
            def={def}
            entries={sectionEntries[def.id]}
            allEntries={allEntries}
            filtered={filtered}
            filter={filters[def.id]}
            onFilter={(next) => setFilters((previous) => ({ ...previous, [def.id]: next }))}
            playground={playground}
            sourceKinds={buildSourceKinds(pickedFor(def.id))}
            pickedUri={pickedFor(def.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      width: "100%",
      paddingVertical: spacing.md,
      gap: spacing.sectionSpacing,
    },
    // The lab's own chrome stays a readable column; the sections below it take
    // the width preset instead.
    chrome: {
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
      gap: spacing.sectionSpacing,
    },
    stage: {
      width: "100%",
      gap: spacing.sectionSpacing,
    },
    gutter: {
      paddingHorizontal: spacing.screenPadding,
    },
    header: {
      gap: spacing.md,
    },
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      gap: spacing.xs,
    },
    chips: {
      gap: spacing.xs,
    },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.smd,
      marginTop: spacing.xs,
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    tagColumn: {
      gap: spacing.xxs,
    },
    tagRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    dim: {
      color: theme.colors.textDim,
    },
  });

const themedStyles = createThemedStyles(createStyles);
