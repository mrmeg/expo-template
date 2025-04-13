import React, { forwardRef } from "react";
import { ScrollView as RNScrollView, ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from "react-native";

interface ScrollViewPropsExtended extends ScrollViewProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

const ScrollView = forwardRef<RNScrollView, ScrollViewPropsExtended>(
  ({ children, contentContainerStyle, style, ...props }, ref) => {
    return (
      <RNScrollView
        {...props}
        contentContainerStyle={[styles.scrollViewContentContainer, contentContainerStyle]}
        ref={ref}
        style={[styles.scrollView, style]}
      >
        {children}
      </RNScrollView>
    );
  }
);
ScrollView.displayName = "ScrollView";

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 1,
    width: "100%",
  },
  scrollViewContentContainer: {
    flexGrow: 1,
  },
});

export { ScrollView };
