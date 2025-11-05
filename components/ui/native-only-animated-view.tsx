import React, { useEffect, useState } from 'react';
import { Animated, ViewProps } from 'react-native';

interface AnimatedViewProps extends ViewProps {
  children: React.ReactNode;
  /**
   * Animation duration in milliseconds for fade in
   */
  enterDuration?: number;
  /**
   * Animation duration in milliseconds for fade out
   */
  exitDuration?: number;
}

/**
 * Cross-Platform Animated View Component
 * Uses React Native's Animated API for consistent behavior across iOS, Android, and Web
 * Automatically fades in on mount with smooth animation
 *
 * Based on the same pattern used in Notification.tsx
 */
export function NativeOnlyAnimatedView({
  children,
  enterDuration = 200,
  exitDuration = 150,
  style,
  ...props
}: AnimatedViewProps) {
  // Create animation state
  const [animationState] = useState({
    fadeAnim: new Animated.Value(0),
  });

  // Trigger fade-in animation on mount
  useEffect(() => {
    // Reset animation
    animationState.fadeAnim.setValue(0);

    // Start fade-in animation
    Animated.timing(animationState.fadeAnim, {
      toValue: 1,
      duration: enterDuration,
      useNativeDriver: true,
    }).start();

    // Cleanup: fade out on unmount
    return () => {
      Animated.timing(animationState.fadeAnim, {
        toValue: 0,
        duration: exitDuration,
        useNativeDriver: true,
      }).start();
    };
  }, [animationState, enterDuration, exitDuration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: animationState.fadeAnim,
        },
      ]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}
