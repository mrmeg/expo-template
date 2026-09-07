/**
 * Spacing Constants
 *
 * A consistent spacing scale based on an 8px base unit, plus a small set of
 * density tokens that components reach for when composing rows, surfaces, and
 * screens. Tune the density tokens to shift the whole library's feel without
 * touching the base scale.
 */

export const spacing = {
  // Base unit: 8px
  base: 8,

  // Spacing scale
  xxs: 2,   // 2px  - Minimal spacing
  xs: 4,    // 4px  - Extra small
  sm: 8,    // 8px  - Small (1 unit)
  smd: 12,  // 12px - Between small and medium (1.5 units); compact gaps and row padding
  md: 16,   // 16px - Medium (2 units)
  mdl: 20,  // 20px - Between medium and large (2.5 units); dialog and sheet padding
  lg: 24,   // 24px - Large (3 units)
  xl: 32,   // 32px - Extra large (4 units)
  xxl: 48,  // 48px - 2x extra large (6 units)
  xxxl: 64, // 64px - 3x extra large (8 units)

  // Common layout spacing
  gutter: 16,        // Standard horizontal gutter
  gutterVertical: 24, // Standard vertical spacing
  screenPadding: 16, // Default screen edge padding
  sectionSpacing: 24, // Space between major sections / grouped lists

  // Density tokens — rows, surfaces, overlays
  rowPaddingY: 10,       // Vertical padding for list / settings rows
  rowPaddingX: 16,       // Horizontal padding for list / settings rows
  rowGap: 12,            // Gap between media, content, and actions in a row
  rowMinHeight: 40,      // Visual min height for rows on pointer surfaces (web)
  formRowMinHeight: 32,  // Visual min height for checkbox / radio rows on web
  cardPadding: 16,       // Default card / stat card padding
  dialogPadding: 20,     // Default dialog / alert dialog padding
  touchTarget: 44,       // Minimum comfortable native touch target

  // Component-specific
  buttonPadding: 10,      // Default button padding
  inputPadding: 10,       // Default input padding
  listItemSpacing: 8,     // Space between list items

  // Border radius — shadcn-inspired scale (radiusMd = 12px default)
  radiusNone: 0,
  radiusXs: 4,
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 14,
  radiusXl: 18,
  radius2xl: 24,
  radiusFull: 9999,      // For circular elements

  // Icon sizes
  iconXs: 12,
  iconSm: 16,
  iconMd: 24,
  iconLg: 32,
  iconXl: 48,
} as const;

// Export individual constants for convenience
export const {
  base,
  xxs,
  xs,
  sm,
  smd,
  md,
  mdl,
  lg,
  xl,
  xxl,
  xxxl,
  gutter,
  gutterVertical,
  screenPadding,
  sectionSpacing,
  rowPaddingY,
  rowPaddingX,
  rowGap,
  rowMinHeight,
  formRowMinHeight,
  cardPadding,
  dialogPadding,
  touchTarget,
  buttonPadding,
  inputPadding,
  listItemSpacing,
  radiusNone,
  radiusXs,
  radiusSm,
  radiusMd,
  radiusLg,
  radiusXl,
  radius2xl,
  radiusFull,
  iconXs,
  iconSm,
  iconMd,
  iconLg,
  iconXl,
} = spacing;

// Helper function to multiply base spacing
export const space = (multiplier: number): number => spacing.base * multiplier;
