import React from "react";
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

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
  content: any;
}

export const KeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps> = ({ children, style }) => {
  return (
    <RNKeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={style}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
};

export const KeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator,
  keyboardShouldPersistTaps,
}) => {
  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
};

export const KeyboardToolbar: React.FC<KeyboardToolbarProps> = ({ content }) => {
  void content;
  return null;
};
