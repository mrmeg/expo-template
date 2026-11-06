/**
 * Data for the Looks demo: the five looks the design boards define, as
 * `@mrmeg/expo-ui` `Look` objects plus the demo-only presentation the package
 * cannot express.
 *
 * Refined is the package default and Classic ships in the package. Strand,
 * Glass and Editorial map the boards' CSS variables onto package tokens:
 * --bg background, --sunken surfaceSunken, --card card + popover, --muted
 * muted + secondary, --fg text/foreground, --dim textDim + mutedForeground,
 * --primary/--on-primary primary(+Foreground), --accent accent, --link link,
 * --border/--border-strong/--input-border border/borderStrong/input, --ring
 * ring, --pos success, --destructive destructive. Vars a board leaves unset
 * take the classic board's value, which is what the board's own CSS fallback
 * does (so Glass and Editorial get the uppercase eyebrow and Editorial the
 * offset focus ring).
 *
 * Raw colors are data here; nothing else in the demo writes a literal.
 */
/* eslint-disable expo-ui/no-raw-colors -- the looks are palettes: raw color values are this file's data */
import { Platform } from "react-native";
import { classicLook, refinedLook, type Look } from "@mrmeg/expo-ui/state";
import type { FontSize, FontWeight } from "@mrmeg/expo-ui/components/StyledText";
import type { FontVariant } from "@mrmeg/expo-ui/constants";

export type Scheme = "light" | "dark";

/** Demo-only presentation: how the sample screens dress up beyond the theme tokens. */
export type DemoDisplay = {
  /** The screen titles ("Overview", "Settings"). `tracking` is in em. */
  title: {
    size: FontSize;
    weight: FontWeight;
    variant?: FontVariant;
    tracking: number;
    uppercase?: boolean;
    /** `font-stretch: 125%` (web only; needs the Archivo `wdth` axis). */
    wide?: boolean;
  };
  /** Metric figures on the stat tiles. When absent the kit's `StatCard` renders them. */
  figure?: { size: FontSize; weight: FontWeight; variant: FontVariant; tracking: number };
  /** Face for eyebrows, tab labels and the "01 /" prefixes. */
  labelVariant?: FontVariant;
  /** Uppercase, tracked tab labels and segment/button text (Strand). */
  tabLabels?: "uppercase";
  /** Selected segment fill: the primary color instead of the treatment's. */
  segmentTint?: "primary";
  /** The sample frame's decoration. */
  chrome: "plain" | "hud" | "glass";
  /** A dot under the active tab. */
  tabDot: boolean;
  /** Strand: faint grid lines over the background. */
  gridLine?: Record<Scheme, string>;
  /** Glass: two blurred-shape colors behind the translucent panels. */
  orbs?: Record<Scheme, [string, string]>;
  /** Glass: the panel and tab-bar fill/edge (rgba), and the web `backdrop-filter`. */
  glass?: {
    panelBorder: Record<Scheme, string>;
    tabBar: Record<Scheme, string>;
    backdropFilter: string;
  };
};

export type DemoLook = {
  look: Look;
  display: DemoDisplay;
  /** A Google Fonts stylesheet the web build injects when the look is selected. */
  fonts?: { webStylesheet: { id: string; href: string } };
  /** `look.fonts` is empty off web; this is what the look asks for there, for the reference snippet. */
  referenceFonts?: Look["fonts"];
};

const ARCHIVO = "\"Archivo\", system-ui, sans-serif";
const JETBRAINS_MONO = "\"JetBrains Mono\", ui-monospace, monospace";

/**
 * Strand's faces. Web: one multi-weight Archivo family for sans (the expanded
 * width is the `font-stretch` the titles ask for) and JetBrains Mono for mono,
 * both from the stylesheet below, so weight is numeric. Native: no font
 * dependency is added, so Strand keeps the default sans and the platform mono;
 * a native family name that is not registered is an error, not a fallback.
 */
const STRAND_WEB_FONTS: NonNullable<Look["fonts"]> = {
  families: { sansSerif: { regular: ARCHIVO }, mono: { regular: JETBRAINS_MONO } },
  webWeightStrategy: "numeric",
};

const STRAND_STYLESHEET = {
  id: "mrmeg-demo-looks-strand",
  href:
    "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900" +
    "&family=JetBrains+Mono:wght@400..700&display=swap",
};

const strandLook: Look = {
  id: "strand",
  name: "Strand",
  description: "Archivo Expanded and JetBrains Mono, carbon and white-out, 2px corners, hairlines, an ice-blue signal.",
  fonts: Platform.OS === "web" ? STRAND_WEB_FONTS : undefined,
  colors: {
    light: {
      surfaceSunken: "#e6e9e6",
      background: "#eef0ee",
      foreground: "#0c0e0f",
      card: "#f7f8f6",
      cardForeground: "#0c0e0f",
      popover: "#f7f8f6",
      popoverForeground: "#0c0e0f",
      text: "#0c0e0f",
      textDim: "#4a5358",
      primary: "#0c0e0f",
      primaryForeground: "#eef0ee",
      secondary: "#e2e6e3",
      secondaryForeground: "#0c0e0f",
      muted: "#e2e6e3",
      mutedForeground: "#4a5358",
      accent: "#0a6aa6",
      accentForeground: "#ffffff",
      link: "#0a6aa6",
      destructive: "#b42f1d",
      destructiveForeground: "#ffffff",
      success: "#17704c",
      warning: "#f59e0b",
      border: "#cdd3d1",
      borderStrong: "#a7afb0",
      input: "#a7afb0",
      ring: "#0a6aa6",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    dark: {
      surfaceSunken: "#070808",
      background: "#0b0c0d",
      foreground: "#e6eaec",
      card: "#101214",
      cardForeground: "#e6eaec",
      popover: "#101214",
      popoverForeground: "#e6eaec",
      text: "#e6eaec",
      textDim: "#8f999f",
      primary: "#e6eaec",
      primaryForeground: "#0b0c0d",
      secondary: "#1a1d20",
      secondaryForeground: "#e6eaec",
      muted: "#1a1d20",
      mutedForeground: "#8f999f",
      accent: "#8fd3ff",
      accentForeground: "#0b0c0d",
      link: "#8fd3ff",
      destructive: "#ff8a7a",
      destructiveForeground: "#0b0c0d",
      success: "#7fe0b4",
      warning: "#fbbf24",
      border: "#262b2f",
      borderStrong: "#3b4248",
      input: "#3b4248",
      ring: "#8fd3ff",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
  },
  shape: {
    button: { borderRadius: 2, withShadow: false },
    input: { borderRadius: 2 },
    card: { borderRadius: 2 },
    sheet: { borderRadius: 2 },
    badge: { borderRadius: 2 },
    dialog: { borderRadius: 2 },
  },
  // The board's switch is primary in light and accent in dark, its selected
  // segment the foreground color, its ring a 1px accent line: none of those
  // is a per-scheme treatment. `primary` / `accent` / `offset` are the closest
  // (the demo tints the segment itself, see `segmentTint`).
  treatments: {
    segmentedSelection: "accent",
    switchTrack: "primary",
    eyebrow: "uppercase",
    focusRing: "offset",
    elevation: "hairline",
  },
};

const glassLook: Look = {
  id: "glass",
  name: "Glass",
  description: "Inter, translucent panels over soft shapes, capsule buttons and segments, 24 radius, a floating tab bar.",
  sans: "inter",
  colors: {
    light: {
      surfaceSunken: "#eef2f2",
      background: "#eef2f2",
      foreground: "#0b0d0e",
      card: "rgba(255, 255, 255, 0.55)",
      cardForeground: "#0b0d0e",
      // Opaque: a popover floats over arbitrary content, where 55% white is unreadable.
      popover: "#fafcfc",
      popoverForeground: "#0b0d0e",
      text: "#0b0d0e",
      textDim: "#4a5257",
      primary: "#0b0d0e",
      primaryForeground: "#ffffff",
      secondary: "rgba(15, 23, 42, 0.06)",
      secondaryForeground: "#0b0d0e",
      muted: "rgba(15, 23, 42, 0.06)",
      mutedForeground: "#4a5257",
      accent: "#0d9488",
      accentForeground: "#052e2b",
      link: "#0f766e",
      destructive: "#dc2626",
      destructiveForeground: "#ffffff",
      success: "#15803d",
      warning: "#f59e0b",
      border: "rgba(15, 23, 42, 0.08)",
      borderStrong: "rgba(15, 23, 42, 0.14)",
      // The board's field edge is white on a white-ish fill, which disappears
      // without the blur behind it; the strong hairline keeps the field visible.
      input: "rgba(15, 23, 42, 0.14)",
      ring: "#0f766e",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    dark: {
      surfaceSunken: "#050607",
      background: "#050607",
      foreground: "#f4f6f6",
      card: "rgba(40, 44, 47, 0.5)",
      cardForeground: "#f4f6f6",
      popover: "#1c1f21",
      popoverForeground: "#f4f6f6",
      text: "#f4f6f6",
      textDim: "#b4bbbe",
      primary: "#f4f6f6",
      primaryForeground: "#0b0d0e",
      secondary: "rgba(255, 255, 255, 0.08)",
      secondaryForeground: "#f4f6f6",
      muted: "rgba(255, 255, 255, 0.08)",
      mutedForeground: "#b4bbbe",
      accent: "#2dd4bf",
      accentForeground: "#0b0d0e",
      link: "#5eead4",
      destructive: "#f87171",
      destructiveForeground: "#0b0d0e",
      success: "#4ade80",
      warning: "#fbbf24",
      border: "rgba(255, 255, 255, 0.1)",
      borderStrong: "rgba(255, 255, 255, 0.18)",
      input: "rgba(255, 255, 255, 0.12)",
      ring: "#5eead4",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
  },
  shape: {
    button: { borderRadius: 9999 },
    input: { borderRadius: 12 },
    card: { borderRadius: 24 },
    sheet: { borderRadius: 24 },
    badge: { borderRadius: 9999 },
    dialog: { borderRadius: 24 },
  },
  treatments: {
    segmentedSelection: "surface",
    switchTrack: "accent",
    eyebrow: "uppercase",
    focusRing: "soft",
    elevation: "layered",
  },
};

const editorialLook: Look = {
  id: "editorial",
  name: "Editorial",
  description: "Newsreader titles and figures with Inter body, warm stone neutrals, deep teal ink, flat and hairline-led.",
  sans: "inter",
  serif: "newsreader",
  colors: {
    light: {
      surfaceSunken: "#f3efe9",
      background: "#faf8f5",
      foreground: "#1c1917",
      card: "#fffdfa",
      cardForeground: "#1c1917",
      popover: "#fffdfa",
      popoverForeground: "#1c1917",
      text: "#1c1917",
      textDim: "#57534e",
      primary: "#1c1917",
      primaryForeground: "#faf8f5",
      secondary: "#f0ebe4",
      secondaryForeground: "#1c1917",
      muted: "#f0ebe4",
      mutedForeground: "#57534e",
      accent: "#0f766e",
      accentForeground: "#ffffff",
      link: "#115e59",
      destructive: "#b91c1c",
      destructiveForeground: "#ffffff",
      success: "#166534",
      warning: "#f59e0b",
      border: "#e7e2db",
      borderStrong: "#d6cfc6",
      input: "#d6cfc6",
      ring: "#78716c",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    dark: {
      surfaceSunken: "#100e0d",
      background: "#151311",
      foreground: "#f4efe8",
      card: "#1d1a17",
      cardForeground: "#f4efe8",
      popover: "#1d1a17",
      popoverForeground: "#f4efe8",
      text: "#f4efe8",
      textDim: "#b4aba1",
      primary: "#f4efe8",
      primaryForeground: "#1c1917",
      secondary: "#29241f",
      secondaryForeground: "#f4efe8",
      muted: "#29241f",
      mutedForeground: "#b4aba1",
      accent: "#5eead4",
      accentForeground: "#1c1917",
      link: "#5eead4",
      destructive: "#f87171",
      destructiveForeground: "#1c1917",
      success: "#86efac",
      warning: "#fbbf24",
      border: "#2e2924",
      borderStrong: "#433c35",
      input: "#433c35",
      ring: "#a8a29e",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
  },
  shape: {
    button: { borderRadius: 6, withShadow: false },
    input: { borderRadius: 6 },
    card: { borderRadius: 10 },
    sheet: { borderRadius: 10 },
    badge: { borderRadius: 9999 },
    dialog: { borderRadius: 10 },
  },
  treatments: {
    segmentedSelection: "surface",
    switchTrack: "primary",
    eyebrow: "uppercase",
    focusRing: "offset",
    elevation: "hairline",
  },
};

export const DEMO_LOOKS: DemoLook[] = [
  {
    look: refinedLook,
    display: {
      title: { size: "xxl", weight: "semibold", tracking: -0.025 },
      chrome: "plain",
      tabDot: true,
    },
  },
  {
    look: classicLook,
    display: {
      title: { size: "xxl", weight: "semibold", tracking: -0.015 },
      chrome: "plain",
      tabDot: false,
    },
  },
  {
    look: strandLook,
    display: {
      title: { size: "xl", weight: "semibold", tracking: 0.08, uppercase: true, wide: true },
      figure: { size: "xxl", weight: "medium", variant: "mono", tracking: -0.01 },
      labelVariant: "mono",
      tabLabels: "uppercase",
      segmentTint: "primary",
      chrome: "hud",
      tabDot: false,
      gridLine: { light: "rgba(10, 106, 166, 0.06)", dark: "rgba(143, 211, 255, 0.05)" },
    },
    fonts: { webStylesheet: STRAND_STYLESHEET },
    referenceFonts: STRAND_WEB_FONTS,
  },
  {
    look: glassLook,
    display: {
      title: { size: "display", weight: "bold", tracking: -0.02 },
      chrome: "glass",
      tabDot: true,
      orbs: { light: ["#5eead4", "#d4d4d8"], dark: ["#115e59", "#3f3f46"] },
      glass: {
        panelBorder: { light: "rgba(255, 255, 255, 0.75)", dark: "rgba(255, 255, 255, 0.12)" },
        tabBar: { light: "rgba(255, 255, 255, 0.6)", dark: "rgba(32, 35, 38, 0.6)" },
        backdropFilter: "blur(24px) saturate(180%)",
      },
    },
  },
  {
    look: editorialLook,
    display: {
      // The board sets 36; the kit's largest step is 34 (`display`).
      title: { size: "display", weight: "medium", variant: "serif", tracking: -0.01 },
      figure: { size: "display", weight: "medium", variant: "serif", tracking: -0.01 },
      chrome: "plain",
      tabDot: true,
    },
  },
];
