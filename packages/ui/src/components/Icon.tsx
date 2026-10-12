import * as React from "react";
import { Platform, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import type { ThemeColors } from "../constants/colors";
import { BUILTIN_ICONS, type BuiltinIconName } from "./iconBuiltins.generated";
import { IconGlyph as GlyphRenderer } from "./IconGlyph";
import type { IconAccessibilityProps, IconComponent, IconGlyph } from "./iconTypes";

export type { IconAccessibilityProps, IconComponent, IconGlyph, IconTag } from "./iconTypes";

/**
 * Every name `Icon` accepts, as keys. The package registers the names its own
 * components draw (`icon-names.json`); an app adds the rest by listing them in
 * `client/icons.json` and running `expo-ui-icons`, whose generated module
 * augments this interface and exports the glyphs for `registerIcons`:
 *
 * ```ts
 * declare module "@mrmeg/expo-ui/components/Icon" {
 *   interface IconRegistry { "archive": true }
 * }
 * ```
 */
export interface IconRegistry extends Record<BuiltinIconName, true> {}

/**
 * Kebab-case Lucide names `Icon` can draw: the package builtins plus every
 * name the app registered. An unregistered literal is a type error.
 */
export type IconName = Extract<keyof IconRegistry, string>;

/** Glyphs by name: the builtins, then whatever `registerIcons` adds. */
const registry = new Map<string, IconGlyph>(Object.entries(BUILTIN_ICONS));

/**
 * Make glyphs drawable by name. Call it once at module scope in the root
 * layout with the module `expo-ui-icons` generates
 * (`registerIcons(appIcons)`), so it has run before any route renders, on the
 * server too. Idempotent; a later call wins for a name it repeats.
 */
export function registerIcons(icons: Readonly<Record<string, IconGlyph>>): void {
  for (const [name, glyph] of Object.entries(icons)) registry.set(name, glyph);
}

/**
 * Whether a runtime value (a database field, a server payload) names a
 * registered icon. Narrows it to `IconName` for `<Icon name>`.
 */
export function isIconName(value: unknown): value is IconName {
  return typeof value === "string" && registry.has(value);
}

/**
 * Theme color names that can be used as shortcuts.
 *
 * Derived from {@link ThemeColors} so it always covers every semantic token
 * (`foreground`, `accent`, `border`, …) and can never drift from the theme.
 */
export type ThemeColorName = keyof ThemeColors;

/**
 * Resolve an icon color against the active theme.
 *
 * A string that names an existing theme color resolves to that semantic color;
 * anything else is treated as a literal color value (hex, `rgb()`, or a CSS
 * named color). Checking the live theme object — rather than a hand-maintained
 * list — means new tokens are usable as icon colors automatically, and a token
 * name never silently falls through as an invalid literal.
 */
function resolveIconColor(color: string | ThemeColorName | undefined, themeColors: ThemeColors): string {
  if (!color) return themeColors.text;
  if (Object.prototype.hasOwnProperty.call(themeColors, color)) {
    return themeColors[color as ThemeColorName];
  }
  return color;
}

type IconBaseProps = {
  /** Size of the icon in pixels */
  size?: number;
  /** Icon color - can be a hex color or a theme color name. Defaults to theme's text color */
  color?: string | ThemeColorName;
  /** Additional styles for positioning, transforms, etc. */
  style?: StyleProp<TextStyle>;
  /**
   * Hides the icon from the accessibility tree. An icon with no
   * `accessibilityLabel` is already hidden (see below), so this is only
   * needed to silence a labelled icon. @default false
   */
  decorative?: boolean;
  /**
   * What the icon means, for an icon that stands alone (no visible label next
   * to it): `role="img"` + `aria-label` on web, `accessible` +
   * `accessibilityLabel` on native. Omit it when the icon sits beside text
   * that already says it — an unlabeled icon is hidden from assistive tech,
   * which would otherwise announce an unnamed image.
   */
  accessibilityLabel?: string;
  /** Test id for a named icon's SVG root. Defaults to `icon-<name>` in development. */
  testID?: string;
};

/**
 * On web the SVG root is a DOM element and React forwards every prop to it,
 * so the RN-only accessibility props (`accessible`,
 * `importantForAccessibility`, `accessibilityElementsHidden`) surface as
 * "unknown prop" warnings on every page. Web gets ARIA only; native keeps
 * the RN props.
 *
 * Only a labelled icon is exposed. An icon without a label used to render as
 * an unnamed `role="img"` (web) or an `accessible` element with nothing to
 * say (native) — dozens per screen, each a WCAG 1.1.1 failure — so no label
 * now means decorative.
 */
function iconAccessibilityProps(decorative: boolean, label: string | undefined): IconAccessibilityProps {
  const hidden = decorative || label === undefined;
  if (Platform.OS === "web") {
    return hidden ? { "aria-hidden": true } : { role: "img", "aria-label": label };
  }
  if (hidden) {
    return {
      accessible: false,
      importantForAccessibility: "no-hide-descendants",
      accessibilityElementsHidden: true,
      "aria-hidden": true,
    };
  }
  return { accessible: true, accessibilityLabel: label };
}

export type NamedIconProps = IconBaseProps & {
  /** A registered icon name: a package builtin or one listed in the app's `client/icons.json`. */
  name: IconName;
  component?: never;
};

export type IconProps =
  | NamedIconProps
  | (IconBaseProps & {
      name?: never;
      /**
       * A component to render instead of a registered glyph, for art that is
       * not a Lucide icon. Receives the resolved size, color, style, and
       * accessibility props, exactly like a named icon.
       */
      component: IconComponent;
    });

const warnedUnknownIconNames = new Set<string>();

function warnUnknownIconName(name: string) {
  if (!__DEV__ || warnedUnknownIconNames.has(name)) return;
  warnedUnknownIconNames.add(name);
  console.warn(
    `Icon: "${name}" is not a registered icon, so nothing was rendered. ` +
      "Add it to client/icons.json, run `bun run icons`, and make sure " +
      "`registerIcons(appIcons)` runs in the root layout."
  );
}

/**
 * Universal Icon Component
 * Draws a registered glyph as SVG with theme integration and style support:
 * an inline `<svg>` on web and the server, `react-native-svg` on iOS and
 * Android. No font to load, and server markup carries the glyph.
 *
 * Usage:
 * ```tsx
 * <Icon name="check" color="primary" size={16} />
 * <Icon name="calendar" color="#FF0000" size={24} />
 * <Icon name="terminal" style={{ marginRight: 8 }} />
 * <Icon component={BrandMark} color="accent" /> // non-Lucide art
 * ```
 */
export function Icon(props: IconProps) {
  const { size = 24, color, style, decorative = false, accessibilityLabel } = props;
  const { theme } = useTheme();
  const iconColor = resolveIconColor(color, theme.colors);

  const CustomComponent = "component" in props ? props.component : undefined;

  const accessibilityProps = iconAccessibilityProps(decorative, accessibilityLabel);

  // `style` stays a text style on the public prop for source compatibility
  // with the font-icon era; SVG roots take a view style, and every layout
  // property callers actually pass (margins, transforms) belongs to both.
  const iconStyle = [style, { pointerEvents: "none" as const }] as StyleProp<ViewStyle>;

  if (CustomComponent) {
    return (
      <CustomComponent
        size={size}
        color={iconColor}
        style={iconStyle}
        {...accessibilityProps}
      />
    );
  }

  const { name, testID } = props as NamedIconProps;
  const glyph = registry.get(name);

  // `IconName` makes an unknown name a type error, but names also arrive at
  // runtime (a database field, a config file) and an app can forget to
  // register. Draw nothing and say so once per name in development.
  if (!glyph) {
    warnUnknownIconName(name);
    return null;
  }

  return (
    <GlyphRenderer
      glyph={glyph}
      size={size}
      color={iconColor}
      style={iconStyle}
      testID={testID ?? (__DEV__ ? `icon-${name}` : undefined)}
      {...accessibilityProps}
    />
  );
}
