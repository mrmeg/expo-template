import React from "react";

interface KeyboardProviderProps {
  children: React.ReactNode;
}

export const PlatformKeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  return <>{children}</>;
};
