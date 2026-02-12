import React from "react";
import { Platform, View, ScrollView } from "react-native";

interface KeyboardAvoidingViewProps {
  children: React.ReactNode;
  style?: any;
}

interface KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: any;
  contentContainerStyle?: any;
  showsVerticalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  bottomOffset?: number;
  extraKeyboardSpace?: number;
  enableOnAndroid?: boolean;
  enableAutomaticScroll?: boolean;
  disableScrollOnKeyboardHide?: boolean;
}

interface KeyboardToolbarProps {
  content: any; // The actual react-native-keyboard-controller accepts a function
}

interface KeyboardControllerType {
  dismiss: () => void;
}

// Web implementations - just passthrough/noop components
const WebKeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps> = ({ children, style }) => {
  return <View style={style}>{children}</View>;
};

const WebKeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator
}) => {
  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {children}
    </ScrollView>
  );
};

const WebKeyboardToolbar: React.FC<KeyboardToolbarProps> = ({ content }) => {
  return null; // No keyboard toolbar needed on web
};

const WebKeyboardController: KeyboardControllerType = {
  dismiss: () => {
    // On web, we can blur the active element
    if (document.activeElement && "blur" in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
  },
};

// Native KeyboardAvoidingView - lazy loaded
const NativeKeyboardAvoidingView = React.lazy(async () => {
  const { KeyboardAvoidingView } = await import("react-native-keyboard-controller");
  return {
    default: KeyboardAvoidingView,
  };
});

// Native KeyboardAwareScrollView - lazy loaded
const NativeKeyboardAwareScrollView = React.lazy(async () => {
  const { KeyboardAwareScrollView } = await import("react-native-keyboard-controller");
  return {
    default: KeyboardAwareScrollView,
  };
});

// Native KeyboardToolbar - lazy loaded
const NativeKeyboardToolbar = React.lazy(async () => {
  const { KeyboardToolbar } = await import("react-native-keyboard-controller");
  return {
    default: ({ content }: KeyboardToolbarProps) => (
      <KeyboardToolbar content={content} />
    ),
  };
});

// Platform-specific exports
export const KeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps> = ({ children, style }) => {
  if (Platform.OS === "web") {
    return <WebKeyboardAvoidingView style={style}>{children}</WebKeyboardAvoidingView>;
  }

  return (
    <React.Suspense fallback={<View style={style}>{children}</View>}>
      <NativeKeyboardAvoidingView style={style}>
        {children}
      </NativeKeyboardAvoidingView>
    </React.Suspense>
  );
};

export const KeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = (props) => {
  if (Platform.OS === "web") {
    return <WebKeyboardAwareScrollView {...props} />;
  }

  const fallback = (
    <ScrollView
      style={props.style}
      contentContainerStyle={props.contentContainerStyle}
      showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
    >
      {props.children}
    </ScrollView>
  );

  return (
    <React.Suspense fallback={fallback}>
      <NativeKeyboardAwareScrollView {...props} />
    </React.Suspense>
  );
};

export const KeyboardToolbar: React.FC<KeyboardToolbarProps> = ({ content }) => {
  if (Platform.OS === "web") {
    return <WebKeyboardToolbar content={content} />;
  }

  return (
    <React.Suspense fallback={null}>
      <NativeKeyboardToolbar content={content} />
    </React.Suspense>
  );
};

// For KeyboardController, we'll create a simple function-based approach
export const KeyboardController: KeyboardControllerType = {
  dismiss: Platform.OS === "web"
    ? WebKeyboardController.dismiss
    : async () => {
      const { KeyboardController } = await import("react-native-keyboard-controller");
      KeyboardController.dismiss();
    },
};
