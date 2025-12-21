import { TextClassContext } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as CollapsiblePrimitive from "@rn-primitives/collapsible";
import * as React from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";

/**
 * Collapsible Component (Root)
 * A wrapper component that provides expand/collapse functionality with smooth animations
 * Using @rn-primitives/collapsible with DaisyUI theme integration
 *
 * Usage:
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <Collapsible open={open} onOpenChange={setOpen}>
 *   <CollapsibleTrigger>
 *     <SansSerifText>Toggle</SansSerifText>
 *   </CollapsibleTrigger>
 *   <CollapsibleContent>
 *     <SansSerifText>Content that expands and collapses</SansSerifText>
 *   </CollapsibleContent>
 * </Collapsible>
 * ```
 */
type CollapsibleProps = CollapsiblePrimitive.RootProps;

function Collapsible({ children, ...props }: CollapsibleProps) {
  return (
    <CollapsiblePrimitive.Root {...props} asChild={Platform.OS !== "web"}>
      <View>{children}</View>
    </CollapsiblePrimitive.Root>
  );
}

/**
 * CollapsibleTrigger Component
 * The trigger button/element that toggles the collapsible state
 * Supports asChild pattern for custom trigger components
 *
 * Usage:
 * ```tsx
 * // Simple trigger
 * <CollapsibleTrigger>
 *   <SansSerifText>Click to expand</SansSerifText>
 * </CollapsibleTrigger>
 *
 * // With asChild (using Button)
 * <CollapsibleTrigger asChild>
 *   <Button preset="outline">
 *     <SansSerifText>Toggle</SansSerifText>
 *   </Button>
 * </CollapsibleTrigger>
 * ```
 */
type CollapsibleTriggerProps = CollapsiblePrimitive.TriggerProps;

function CollapsibleTrigger({ style: styleOverride, ...props }: CollapsibleTriggerProps) {
  const { theme } = useTheme();

  return (
    <TextClassContext.Provider value="">
      <CollapsiblePrimitive.Trigger
        {...props}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.sm,
          ...(Platform.OS === "web" && {
            cursor: "pointer" as any,
            outlineStyle: "none" as any,
          }),
          ...(styleOverride && typeof styleOverride !== "function"
            ? StyleSheet.flatten(styleOverride)
            : {}),
        }}
      />
    </TextClassContext.Provider>
  );
}

/**
 * CollapsibleContent Component
 * The content that expands and collapses
 * Includes exit animation on native platforms
 *
 * Usage:
 * ```tsx
 * <CollapsibleContent>
 *   <View>
 *     <SansSerifText>This content will animate in and out</SansSerifText>
 *   </View>
 * </CollapsibleContent>
 * ```
 */
type CollapsibleContentProps = CollapsiblePrimitive.ContentProps & {
  /**
   * Whether to force remove the content from the tree when closed
   * Default: false (content remains in tree but hidden)
   */
  forceMount?: boolean;
};

function CollapsibleContent({
  forceMount,
  style: styleOverride,
  children,
  ...props
}: CollapsibleContentProps) {
  const { theme } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  return (
    <TextClassContext.Provider value="">
      <CollapsiblePrimitive.Content
        {...props}
        forceMount={forceMount}
      >
        <Animated.View
          style={{
            overflow: "hidden",
            opacity: fadeAnim,
            ...(styleOverride && typeof styleOverride !== "function"
              ? StyleSheet.flatten(styleOverride)
              : {}),
          }}
        >
          {children}
        </Animated.View>
      </CollapsiblePrimitive.Content>
    </TextClassContext.Provider>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
export type { CollapsibleProps, CollapsibleTriggerProps, CollapsibleContentProps };
