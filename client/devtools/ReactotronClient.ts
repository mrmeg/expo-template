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

  // Extend console with Reactotron logging
  const originalConsole = { ...console };

  // Optionally override console methods
  // Uncomment to see console logs in Reactotron
  // console.log = (...args: unknown[]) => {
  //   originalConsole.log(...args);
  //   reactotron.log?.(...args);
  // };

  return reactotron;
}

/**
 * Reactotron instance for direct access.
 * Use for custom logging and debugging.
 *
 * @example
 * import { reactotron } from '@/client/devtools/ReactotronClient';
 * reactotron.log?.('Custom message');
 * reactotron.warn?.('Warning message');
 * reactotron.display({ name: 'API_CALL', value: response });
 */
export const reactotron = Reactotron;

export default Reactotron;
