/**
 * Data for the Looks demo: five looks as `@mrmeg/expo-ui` `Look` objects plus
 * the demo-only presentation the package cannot express.
 *
 * Refined is the package default and Classic ships in the package. Meridian
 * does not come from the design boards: it was designed on the Housefold hub
 * canvas (cool carbon neutrals, hairlines and one blue signal, with
 * Editorial's soft corners), so its values are authored here. Its titles,
 * figures, eyebrows and tab labels stay the default sans (Allo); Newsreader
 * (`serif`) and Geist Mono (`mono`, web) are there for an app that asks for them.
 *
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
  };
  /** Metric figures on the stat tiles. When absent the kit's `StatCard` renders them. */
  figure?: { size: FontSize; weight: FontWeight; variant: FontVariant; tracking: number };
  /** The sample frame's decoration. */
  chrome: "plain" | "glass";
  /** A dot under the active tab. */
  tabDot: boolean;
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

const GEIST_MONO = "\"Geist Mono\", ui-monospace, monospace";

/**
 * Meridian's one face override. Web: Geist Mono for mono (time axes), from the
 * stylesheet below, weight numeric; sans stays the kit's default (Allo) and
 * serif the Newsreader preset. Native: no font dependency is added, so Meridian
 * keeps the platform mono; a native family name that is not registered is an
 * error, not a fallback.
 */
const MERIDIAN_WEB_FONTS: NonNullable<Look["fonts"]> = {
  families: { mono: { regular: GEIST_MONO } },
  webWeightStrategy: "numeric",
};

const MERIDIAN_STYLESHEET = {
  id: "mrmeg-demo-looks-meridian",
  href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400..600&display=swap",
};

const meridianLook: Look = {
  id: "meridian",
  name: "Meridian",
  description: "Allo, with Newsreader for one headline and Geist Mono for time axes, cool carbon neutrals, soft 6 / 12 corners, hairlines, one blue signal.",
  serif: "newsreader",
  fonts: Platform.OS === "web" ? MERIDIAN_WEB_FONTS : undefined,
  colors: {
    light: {
      surfaceSunken: "#eceeeb",
      background: "#f5f6f4",
      foreground: "#111416",
      card: "#fcfcfb",
      cardForeground: "#111416",
      popover: "#fcfcfb",
      popoverForeground: "#111416",
      text: "#111416",
      textDim: "#485158",
      primary: "#111416",
      primaryForeground: "#f5f6f4",
      secondary: "#e9ebe8",
      secondaryForeground: "#111416",
      muted: "#e9ebe8",
      mutedForeground: "#485158",
      accent: "#1d5fc4",
      accentForeground: "#ffffff",
      link: "#1d5fc4",
      destructive: "#b42f1d",
      destructiveForeground: "#ffffff",
      success: "#17704c",
      warning: "#f59e0b",
      border: "#dcdfdc",
      borderStrong: "#c2c7c5",
      input: "#c2c7c5",
      ring: "#1d5fc4",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    dark: {
      surfaceSunken: "#090a0c",
      background: "#0d0f11",
      foreground: "#eceff1",
      card: "#14171a",
      cardForeground: "#eceff1",
      popover: "#14171a",
      popoverForeground: "#eceff1",
      text: "#eceff1",
      textDim: "#a0aab1",
      primary: "#eceff1",
      primaryForeground: "#0d0f11",
      secondary: "#1d2125",
      secondaryForeground: "#eceff1",
      muted: "#1d2125",
      mutedForeground: "#a0aab1",
      accent: "#8cc2ff",
      accentForeground: "#0d0f11",
      link: "#8cc2ff",
      destructive: "#ff8a7a",
      destructiveForeground: "#0d0f11",
      success: "#7fe0b4",
      warning: "#fbbf24",
      border: "#262b30",
      borderStrong: "#3a4148",
      input: "#3a4148",
      ring: "#8cc2ff",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
  },
  shape: {
    button: { borderRadius: 6, withShadow: false },
    input: { borderRadius: 6 },
    card: { borderRadius: 12 },
    sheet: { borderRadius: 12 },
    badge: { borderRadius: 9999 },
    dialog: { borderRadius: 12 },
  },
  treatments: {
    segmentedSelection: "surface",
    switchTrack: "primary",
    eyebrow: "sentence",
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
    look: meridianLook,
    display: {
      title: { size: "xxl", weight: "semibold", tracking: -0.02 },
      chrome: "plain",
      tabDot: true,
    },
    fonts: { webStylesheet: MERIDIAN_STYLESHEET },
    referenceFonts: MERIDIAN_WEB_FONTS,
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
