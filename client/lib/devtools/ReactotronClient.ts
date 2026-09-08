/**
 * Reactotron client for React Native (iOS/Android).
 * Provides debugging, logging, and state inspection.
 */

import Reactotron from "reactotron-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Configure and connect Reactotron for native platforms.
 * Features:
 * - AsyncStorage monitoring
 * - Network request logging
 * - Console log capture
 * - Custom commands
 */
export function setupReactotron() {
  const reactotron = Reactotron.setAsyncStorageHandler(AsyncStorage)
    .configure({
      name: "Expo Template",
      onDisconnect: () => {
        console.log("Reactotron disconnected");
      },
    })
    .useReactNative({
      asyncStorage: {
        ignore: ["secret"],
      },
      networking: {
        ignoreUrls: /symbolicate|127\.0\.0\.1/,
      },
      errors: {
        veto: () => false,
      },
    })
    .connect();

  // Clear on start for fresh debugging session
  reactotron.clear?.();

  return reactotron;
}
