/**
 * Jest test setup file.
 * Runs after the test environment is set up but before tests run.
 */

// Extended matchers are auto-imported in newer versions
// If using older version, uncomment: import "@testing-library/react-native/extend-expect";

// Mock expo-font
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn().mockResolvedValue(true),
}));

// Mock expo-splash-screen
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
}));

// Mock expo-localization
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
  locale: "en-US",
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    GestureHandlerRootView: View,
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
    Gesture: {
      Pan: () => ({
        onBegin: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      }),
      Tap: () => ({
        onBegin: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      }),
    },
  };
});

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => "/",
  Link: "Link",
  Stack: {
    Screen: "Screen",
  },
  Redirect: "Redirect",
}));

// Mock i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "en",
      changeLanguage: jest.fn().mockResolvedValue(undefined),
    },
  }),
  initReactI18next: {
    type: "3rdParty",
    init: jest.fn(),
  },
}));

// Mock Lucide icons
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  const createMockIcon = () => View;
  return new Proxy(
    {},
    {
      get: () => createMockIcon(),
    }
  );
});

// Silence console warnings/errors in tests (optional)
// Uncomment to reduce noise in test output
// const originalConsoleError = console.error;
// const originalConsoleWarn = console.warn;
// beforeAll(() => {
//   console.error = (...args) => {
//     if (args[0]?.includes?.("Warning:")) return;
//     originalConsoleError(...args);
//   };
//   console.warn = (...args) => {
//     if (args[0]?.includes?.("Warning:")) return;
//     originalConsoleWarn(...args);
//   };
// });
// afterAll(() => {
//   console.error = originalConsoleError;
//   console.warn = originalConsoleWarn;
// });

// Global test timeout
jest.setTimeout(10000);
