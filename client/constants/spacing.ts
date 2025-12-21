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
  buttonPadding: 12,      // Default button padding
  inputPadding: 12,       // Default input padding
  cardPadding: 16,        // Default card padding
  sectionSpacing: 32,     // Space between major sections
  listItemSpacing: 12,    // Space between list items

  // Border radius
  radiusNone: 0,
  radiusXs: 2,
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  radiusXl: 16,
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
  radiusFull,
  iconXs,
  iconSm,
  iconMd,
  iconLg,
  iconXl,
} = spacing;

// Helper function to multiply base spacing
export const space = (multiplier: number): number => spacing.base * multiplier;
