import React from "react";
import { Platform } from "react-native";

interface KeyboardProviderProps {
  children: React.ReactNode;
}

// Web implementation - just a passthrough component
const WebKeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  return <>{children}</>;
};

// Native implementation - lazy load the actual keyboard controller
const NativeKeyboardProvider = React.lazy(async () => {
  const { KeyboardProvider } = await import("react-native-keyboard-controller");
  return {
    default: ({ children }: KeyboardProviderProps) => (
      <KeyboardProvider>{children}</KeyboardProvider>
    ),
  };
});

export const PlatformKeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  if (Platform.OS === "web") {
    return <WebKeyboardProvider>{children}</WebKeyboardProvider>;
  }

  return (
    <React.Suspense fallback={<>{children}</>}>
      <NativeKeyboardProvider>{children}</NativeKeyboardProvider>
    </React.Suspense>
  );
};
