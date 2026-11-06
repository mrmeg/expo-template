/**
 * Reference values for one look, resolved from the `Look` object itself.
 *
 * Nothing here is typed by hand: colors are the look's overrides merged over
 * the package's raw palette (Refined has no overrides, so this is what gives it
 * swatches), treatments merge over `defaultTreatments`, radii over
 * `defaultShapeRadius`, font families come from `resolveFontStyle`, and the
 * usage snippet is generated from the object. Pure data, no React, no previews:
 * the Explore tab, the drawer and the stack header read it eagerly.
 */

import {
  rawThemeColors,
  resolveFontStyle,
  type FontVariant,
  type ThemeColorTokens,
} from "@mrmeg/expo-ui/constants";
import {
  defaultButtonShadow,
  defaultShapeRadius,
  defaultTreatments,
  type ShapeSlot,
  type Treatment,
} from "@mrmeg/expo-ui/state";

import { DEMO_LOOKS, type DemoLook, type Scheme } from "./looks";

export type ColorToken = keyof ThemeColorTokens;

export type ResolvedColors = Record<Scheme, ThemeColorTokens>;

/** Every semantic color token for each scheme: the look's value, else the package's. */
export function resolveLookColors(look: DemoLook["look"]): ResolvedColors {
  return {
    light: { ...rawThemeColors.light, ...look.colors?.light },
    dark: { ...rawThemeColors.dark, ...look.colors?.dark },
  };
}

export interface ColorRow {
  token: ColorToken;
  light: string;
  dark: string;
  /** The look sets this token in at least one scheme. */
  changed: boolean;
}

export function lookColorRows(look: DemoLook["look"]): ColorRow[] {
  const resolved = resolveLookColors(look);
  return (Object.keys(rawThemeColors.light) as ColorToken[]).map((token) => ({
    token,
    light: resolved.light[token],
    dark: resolved.dark[token],
    changed: look.colors?.light?.[token] !== undefined || look.colors?.dark?.[token] !== undefined,
  }));
}

/** The tokens a tile's swatch strip draws, in order. */
export const STRIP_TOKENS = ["background", "card", "text", "accent", "primary"] as const satisfies readonly ColorToken[];

export function lookStrip(look: DemoLook["look"], scheme: Scheme): string[] {
  const colors = resolveLookColors(look)[scheme];
  return STRIP_TOKENS.map((token) => colors[token]);
}

export interface ShapeRow {
  slot: ShapeSlot;
  /** A radius in points, or `"platform"` where the platform draws the corners. */
  radius: number | "platform";
  changed: boolean;
}

export function lookShapeRows(look: DemoLook["look"]): ShapeRow[] {
  return (Object.keys(defaultShapeRadius) as ShapeSlot[]).map((slot) => {
    const override = look.shape?.[slot]?.borderRadius;
    return {
      slot,
      radius: override ?? defaultShapeRadius[slot],
      changed: override !== undefined && override !== defaultShapeRadius[slot],
    };
  });
}

/** Whether the default Button preset draws its shadow (`shape.button.withShadow`). */
export function lookButtonShadow(look: DemoLook["look"]): boolean {
  return look.shape?.button?.withShadow ?? defaultButtonShadow;
}

export interface TreatmentRow {
  name: Treatment;
  value: string;
  changed: boolean;
}

export function lookTreatmentRows(look: DemoLook["look"]): TreatmentRow[] {
  const merged = { ...defaultTreatments, ...look.treatments };
  return (Object.keys(defaultTreatments) as Treatment[]).map((name) => ({
    name,
    value: merged[name],
    changed: look.treatments?.[name] !== undefined && look.treatments[name] !== defaultTreatments[name],
  }));
}

export interface FontRow {
  variant: FontVariant;
  /** The first family of the resolved stack, e.g. `Geist` or `Newsreader_400Regular`. */
  family: string;
}

const FONT_VARIANTS: FontVariant[] = ["sansSerif", "serif", "mono"];

/** The first name in a CSS stack; native family names pass through unchanged. */
function firstFamily(stack: string): string {
  return stack.split(",")[0].replace(/["']/g, "").trim();
}

/** The families the look resolves to on this platform. */
export function lookFontRows(look: DemoLook["look"]): FontRow[] {
  return FONT_VARIANTS.map((variant) => ({
    variant,
    family: firstFamily(
      resolveFontStyle(look.fonts ?? {}, variant, "regular", {
        sansPreset: look.sans ?? "geist",
        serifPreset: look.serif ?? "georgia",
      }).fontFamily,
    ),
  }));
}

// ---------------------------------------------------------------------------
// Usage snippet
// ---------------------------------------------------------------------------

/** Looks that ship in `@mrmeg/expo-ui/state`; the rest live in this template. */
const PACKAGE_EXPORTS: Record<string, string> = {
  refined: "refinedLook",
  classic: "classicLook",
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A TypeScript-literal rendering of plain data: bare keys, double-quoted strings, 2-space indent. */
function literal(value: unknown, depth = 0): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const pad = "  ".repeat(depth + 1);
  const close = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return `[${value.map((item) => literal(item, depth + 1)).join(", ")}]`;
  }
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([key, entry]) => `${pad}${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${literal(entry, depth + 1)},`);
  return `{\n${lines.join("\n")}\n${close}}`;
}

/** The `Look` fields, in a stable reading order, without the ones the look leaves unset. */
function lookLiteral(demo: DemoLook): string {
  const { look } = demo;
  // Strand's families are web-only in the live object; the reference shows what it asks for there.
  const fonts = demo.referenceFonts ?? look.fonts;
  return literal({
    id: look.id,
    name: look.name,
    description: look.description,
    sans: look.sans,
    serif: look.serif,
    fonts,
    colors: look.colors,
    shape: look.shape,
    treatments: look.treatments,
  });
}

/** What the look needs loaded before `applyLook`, one line each. */
export function lookFontNotes(demo: DemoLook): string[] {
  const notes: string[] = [];
  const { look } = demo;
  if (look.sans === "inter") {
    notes.push("Inter: on native `useResources({ sans: \"inter\", sansFonts })` with @expo-google-fonts/inter; web loads the stylesheet.");
  }
  if (look.serif === "newsreader") {
    notes.push("Newsreader: `useResources({ serif: \"newsreader\", serifFonts })` with @expo-google-fonts/newsreader; web loads the stylesheet.");
  }
  if (demo.fonts) {
    notes.push(`Web stylesheet to load first: ${demo.fonts.webStylesheet.href}`);
  }
  if (demo.referenceFonts) {
    notes.push("These families are web only; on native the template keeps the default sans and the platform mono.");
  }
  return notes;
}

/**
 * The code that puts this look on an app. Package looks are one import and one
 * call. A template look is the `Look` object to copy, with the fonts it needs
 * noted above it.
 */
export function lookSnippet(demo: DemoLook): string {
  const { look } = demo;
  const exported = PACKAGE_EXPORTS[look.id];
  const notes = lookFontNotes(demo).map((note) => `// ${note}`);

  if (exported) {
    return [
      `import { applyLook, ${exported} } from "@mrmeg/expo-ui/state";`,
      ...(notes.length > 0 ? ["", ...notes] : []),
      "",
      "// Once at startup, before the first render.",
      `applyLook(${exported});`,
    ].join("\n");
  }

  return [
    "import { applyLook, type Look } from \"@mrmeg/expo-ui/state\";",
    ...(notes.length > 0 ? ["", ...notes] : []),
    "",
    `const ${look.id}Look: Look = ${lookLiteral(demo)};`,
    "",
    "// Once at startup, before the first render.",
    `applyLook(${look.id}Look);`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function getDemoLook(id: string | undefined): DemoLook | undefined {
  return DEMO_LOOKS.find((demo) => demo.look.id === id);
}

/** The look before and after this one, wrapping around the list. */
export function neighbourLooks(id: string): { previous: DemoLook; next: DemoLook } | undefined {
  const index = DEMO_LOOKS.findIndex((demo) => demo.look.id === id);
  if (index < 0) return undefined;
  return {
    previous: DEMO_LOOKS[(index - 1 + DEMO_LOOKS.length) % DEMO_LOOKS.length],
    next: DEMO_LOOKS[(index + 1) % DEMO_LOOKS.length],
  };
}
