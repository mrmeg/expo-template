import * as React from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { LucideIcon } from 'lucide-react-native';

export interface IconProps {
  /**
   * The Lucide icon component to render
   */
  as: LucideIcon;
  /**
   * Size of the icon in pixels
   */
  size?: number;
  /**
   * Stroke width of the icon
   */
  strokeWidth?: number;
  /**
   * Additional CSS class names
   */
  className?: string;
  /**
   * Icon color - defaults to theme's base-content
   */
  color?: string;
}

/**
 * Universal Icon Component
 * Wraps Lucide React Native icons with theme integration and className support
 *
 * Usage:
 * ```tsx
 * import { Check } from 'lucide-react-native';
 * <Icon as={Check} size={16} className="text-primary" />
 * ```
 */
export function Icon({
  as: LucideIconComponent,
  size = 24,
  strokeWidth = 2,
  className,
  color,
}: IconProps) {
  const { theme } = useTheme();

  // Use provided color or default to theme's base-content
  const iconColor = color || theme.colors['base-content'];

  return (
    <LucideIconComponent
      size={size}
      strokeWidth={strokeWidth}
      color={iconColor}
    />
  );
}
