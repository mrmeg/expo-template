/**
 * Spacing Constants
 *
 * A consistent spacing scale based on an 8px base unit.
 * Use these constants throughout the app for consistent spacing.
 */

export const spacing = {
  // Base unit: 8px
  base: 8,

  // Spacing scale
  xxs: 2,   // 2px  - Minimal spacing
  xs: 4,    // 4px  - Extra small
  sm: 8,    // 8px  - Small (1 unit)
  md: 16,   // 16px - Medium (2 units)
  lg: 24,   // 24px - Large (3 units)
  xl: 32,   // 32px - Extra large (4 units)
  xxl: 48,  // 48px - 2x extra large (6 units)
  xxxl: 64, // 64px - 3x extra large (8 units)

  // Common layout spacing
  gutter: 16,        // Standard horizontal gutter
  gutterVertical: 24, // Standard vertical spacing
  screenPadding: 16, // Default screen edge padding

  // Component-specific
  buttonPadding: 10,      // Default button padding
  inputPadding: 10,       // Default input padding
  cardPadding: 16,        // Default card padding
  sectionSpacing: 32,     // Space between major sections
  listItemSpacing: 8,     // Space between list items

  // Border radius — shadcn-inspired scale (radiusMd = 6px default)
  radiusNone: 0,
  radiusXs: 2,
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 8,
  radiusXl: 12,
  radius2xl: 16,
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
  md,
  lg,
  xl,
  xxl,
  xxxl,
  gutter,
  gutterVertical,
  screenPadding,
  buttonPadding,
  inputPadding,
  cardPadding,
  sectionSpacing,
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
