import { Platform } from "react-native";

// RN core Animated's native driver is not available on web.
export const shouldUseNativeDriver = Platform.OS !== "web";
