/**
 * Jest test setup file.
 * Runs after the test environment is set up but before tests run.
 */

// Extended matchers are auto-imported in newer versions
// If using older version, uncomment: import "@testing-library/react-native/extend-expect";

// Mock expo-font (provide Font.isLoaded used by @expo/vector-icons)
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
  Font: {
    isLoaded: jest.fn(() => true),
    isLoading: jest.fn(() => false),
    loadAsync: jest.fn().mockResolvedValue(true),
  },
}));

// Mock @expo/vector-icons — render icons as plain Views so tests don't depend on font loading
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  const makeIcon = (name: string) =>
    function MockIcon(props: any) {
      return React.createElement(View, { ...props, testID: props.testID || `icon-${name}` });
    };
  return {
    Ionicons: makeIcon("Ionicons"),
    MaterialIcons: makeIcon("MaterialIcons"),
    MaterialCommunityIcons: makeIcon("MaterialCommunityIcons"),
    FontAwesome: makeIcon("FontAwesome"),
    FontAwesome5: makeIcon("FontAwesome5"),
    FontAwesome6: makeIcon("FontAwesome6"),
    Feather: makeIcon("Feather"),
    AntDesign: makeIcon("AntDesign"),
    Entypo: makeIcon("Entypo"),
    EvilIcons: makeIcon("EvilIcons"),
    Foundation: makeIcon("Foundation"),
    Octicons: makeIcon("Octicons"),
    SimpleLineIcons: makeIcon("SimpleLineIcons"),
    Zocial: makeIcon("Zocial"),
    Fontisto: makeIcon("Fontisto"),
  };
});

jest.mock("@expo/vector-icons/Feather", () => {
  const React = require("react");
  const { View } = require("react-native");
  function MockFeather(props: any) {
    return React.createElement(View, { ...props, testID: props.testID || "icon-Feather" });
  }
  MockFeather.font = {};
  return {
    __esModule: true,
    default: MockFeather,
  };
});

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

// Mock react-native-reanimated (v4 no longer ships a mock entry point)
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      call: jest.fn(),
      View: require("react-native").View,
      Text: require("react-native").Text,
      ScrollView: require("react-native").ScrollView,
      Image: require("react-native").Image,
      createAnimatedComponent: (component: unknown) => component,
    },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useReducedMotion: () => false,
    withTiming: (val: unknown) => val,
    withSpring: (val: unknown) => val,
    withDelay: (_: number, val: unknown) => val,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withRepeat: (val: unknown) => val,
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      bezier: () => jest.fn(),
      inOut: jest.fn(),
      in: jest.fn(),
      out: jest.fn(),
    },
    FadeIn: { duration: () => ({ delay: () => ({ build: () => ({}) }) }), delay: () => ({ build: () => ({}) }), build: () => ({}) },
    FadeOut: { duration: () => ({ build: () => ({}) }), build: () => ({}) },
    SlideInDown: { duration: () => ({ build: () => ({}) }), build: () => ({}) },
    SlideOutDown: { duration: () => ({ build: () => ({}) }), build: () => ({}) },
    SlideInUp: { duration: () => ({ build: () => ({}) }), build: () => ({}) },
    SlideOutUp: { duration: () => ({ build: () => ({}) }), build: () => ({}) },
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    interpolate: jest.fn((val: number) => val),
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend" },
    ReduceMotion: { System: "system", Always: "always", Never: "never" },
    createAnimatedComponent: (component: unknown) => component,
    Animated: { View, Text: require("react-native").Text, ScrollView: require("react-native").ScrollView },
  };
});

// Mock react-native-safe-area-context so tests don't require a provider tree
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };
  const SafeAreaInsetsContext = React.createContext(insets);
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }: any) => React.createElement(View, props, children),
    SafeAreaInsetsContext,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
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

// Mock expo-image-manipulator
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn().mockReturnThis(),
      rotate: jest.fn().mockReturnThis(),
      flip: jest.fn().mockReturnThis(),
      crop: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest.fn().mockResolvedValue({
          uri: "file:///mock/compressed.jpg",
          width: 1024,
          height: 768,
        }),
        width: 1024,
        height: 768,
      }),
    })),
  },
  SaveFormat: {
    JPEG: "jpeg",
    PNG: "png",
    WEBP: "webp",
  },
}));

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    size: 50000, // 50KB mock size
    delete: jest.fn(),
  })),
  Directory: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    list: jest.fn().mockReturnValue([]),
    delete: jest.fn(),
  })),
  Paths: {
    cache: { uri: "file:///mock/cache" },
    document: { uri: "file:///mock/document" },
  },
}));

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
