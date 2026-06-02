import React from "react";
import type { StyleProp, TextStyle } from "react-native";

export const TextClassContext = React.createContext<string | undefined>(undefined);
export const TextColorContext = React.createContext<string | undefined>(undefined);
export const TextStyleContext = React.createContext<StyleProp<TextStyle> | undefined>(undefined);
export const TextSelectabilityContext = React.createContext<boolean | undefined>(undefined);
