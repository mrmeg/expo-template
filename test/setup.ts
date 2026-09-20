/**
 * Jest test setup file.
 * Runs after the test environment is set up but before tests run.
 */

// Extended matchers are auto-imported in newer versions
// If using older version, uncomment: import "@testing-library/react-native/extend-expect";

// expo-image 57.0.2+ wires an optional expo-observe integration at import time.
// jest-expo's native-module proxy is truthy but lacks getIntegrations(), so the
// init call throws. Resolve the optional module to null, matching a runtime
// without expo-observe installed.
jest.mock("expo", () => {
  const actual = jest.requireActual("expo");
  return {
    ...actual,
    requireOptionalNativeModule: (name: string) =>
      name === "ExpoObserve" ? null : actual.requireOptionalNativeModule(name),
  };
});

// Mock expo-font
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

// Mock the Icon registry — every name renders as a plain View tagged
// `icon-<name>` so tests find icons by name without loading any Lucide module
// or react-native-svg. Jest maps `@mrmeg/expo-ui/components/*` to
// `packages/ui/src/components/*` (jest.config.js), so this one mock covers the
// package suites and the app suites alike. The Proxy answers for any name: an
// unknown name is a type error at the call site, not a runtime miss.
jest.mock("../packages/ui/src/components/iconRegistry.generated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const cache = new Map<string, React.ComponentType<any>>();
  const iconFor = (name: string) => {
    let MockIcon = cache.get(name);
    if (!MockIcon) {
      MockIcon = function MockLucideIcon(props: any) {
        return React.createElement(View, { ...props, testID: props.testID ?? `icon-${name}` });
      };
      (MockIcon as any).displayName = `MockIcon(${name})`;
      cache.set(name, MockIcon);
    }
    return MockIcon;
  };
  const ICONS = new Proxy(
    {},
    {
      // Names prefixed `missing-` stay undefined so tests can exercise the
      // runtime fallback for a name outside the registry.
      get: (_target, name) =>
        typeof name === "string" && !name.startsWith("missing-") ? iconFor(name) : undefined,
      has: (_target, name) => typeof name === "string" && !name.startsWith("missing-"),
    }
  );
  return { __esModule: true, ICONS };
});

// Mock @expo/ui (bare entry) — jest-expo reports Platform.OS === "ios", so the
// UI TextInput routes to the native @expo/ui field, which would otherwise call
// requireNativeModule('ExpoUI'). Render it as a plain RN TextInput so existing
// tests keep exercising real behavior. `useNativeState` becomes a stable
// { value } object (mirrors the web polyfill). Community submodules
// (@expo/ui/community/*) are NOT intercepted here — those are mocked per-file.
jest.mock("@expo/ui", () => {
  const React = require("react");
  const { TextInput: RNTextInput, View } = require("react-native");

  function useNativeState(initialValue: unknown) {
    const ref = React.useRef({ value: initialValue });
    return ref.current;
  }

  // Host is a bridging container on device; in tests it's just a passthrough View.
  const Host = ({ children, style }: any) =>
    React.createElement(View, { style }, children);

  const TextInput = React.forwardRef(function MockExpoTextInput(props: any, ref: any) {
    const { value, defaultValue, onChangeText, style, textStyle, ...rest } = props;
    const observable = value && typeof value === "object" ? value : null;
    const stringValue = observable ? observable.value : value;
    const innerRef = React.useRef(null);

    React.useImperativeHandle(ref, () => ({
      focus: () => innerRef.current?.focus(),
      blur: () => innerRef.current?.blur(),
      clear: () => {},
      isFocused: () => innerRef.current?.isFocused?.() ?? false,
      setSelection: () => Promise.resolve(),
    }));

    return React.createElement(RNTextInput, {
      ...rest,
      ref: innerRef,
      value: stringValue,
      defaultValue,
      onChangeText: (text: string) => {
        if (observable) observable.value = text;
        onChangeText?.(text);
      },
      style: [style, textStyle],
    });
  });

  return { __esModule: true, Host, TextInput, useNativeState };
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

// Mock react-native-keyboard-controller so package tests do not require a
// linked native module.
jest.mock("react-native-keyboard-controller", () => {
  const React = require("react");
  const { View, ScrollView } = require("react-native");
  const keyboardState = {
    isVisible: false,
    height: 0,
    duration: 0,
    timestamp: 0,
    target: -1,
    type: "default",
    appearance: "light",
  };
  const keyboardEventListeners = new Map<string, Set<(event: unknown) => void>>();
  const keyboardContext = {
    layout: { value: null as any },
    update: jest.fn(),
    setKeyboardHandlers: jest.fn(() => jest.fn()),
    setInputHandlers: jest.fn(() => jest.fn()),
    setEnabled: jest.fn(),
    enabled: true,
    animated: {},
    reanimated: {},
  };

  const PassthroughView = React.forwardRef(function PassthroughView(
    { children, style, ...props }: any,
    ref: any
  ) {
    return React.createElement(View, { ...props, ref, style }, children);
  });

  return {
    KeyboardProvider: ({ children }: any) => React.createElement(View, null, children),
    KeyboardAvoidingView: PassthroughView,
    KeyboardAwareScrollView: ScrollView,
    KeyboardStickyView: PassthroughView,
    KeyboardToolbar: PassthroughView,
    useKeyboardContext: () => keyboardContext,
    KeyboardController: {
      dismiss: jest.fn(),
      state: () => keyboardState,
      isVisible: () => keyboardState.isVisible,
    },
    useKeyboardState: (selector?: (state: typeof keyboardState) => unknown) =>
      selector ? selector(keyboardState) : keyboardState,
    KeyboardEvents: {
      addListener: (name: string, cb: (event: unknown) => void) => {
        const listeners = keyboardEventListeners.get(name) ?? new Set();
        listeners.add(cb);
        keyboardEventListeners.set(name, listeners);
        return { remove: () => listeners.delete(cb) };
      },
    },
    __setKeyboardState: (next: Partial<typeof keyboardState>) => {
      Object.assign(keyboardState, next);
    },
    /** Fire a `KeyboardEvents` event at every subscriber, like the native emitter. */
    __emitKeyboardEvent: (name: string, event: Record<string, unknown> = {}) => {
      keyboardEventListeners.get(name)?.forEach((cb) => cb({ height: 0, duration: 0, timestamp: 0, target: -1, ...event }));
    },
    __keyboardEventListenerCount: (name: string) => keyboardEventListeners.get(name)?.size ?? 0,
    __setFocusedInputLayout: (layout: any) => {
      keyboardContext.layout.value = layout
        ? { target: keyboardState.target, parentScrollViewTarget: -1, layout }
        : null;
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
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
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

// The entry-pathname record in client/lib/clientNavigation.ts is module scope,
// which `clearMocks`/`restoreMocks` do not touch. Without this reset, one test
// simulating a navigation would silently move every later test in the same file
// onto the deferred-preview path. Every suite therefore starts on the
// "arrived here" (full-render) path unless it opts in. Required lazily so a suite
// that mocks the module still gets its own reset.
beforeEach(() => {
  const { resetClientNavigationForTests } = require("@/client/lib/clientNavigation");
  resetClientNavigationForTests();
});

// Global test timeout
jest.setTimeout(10000);
