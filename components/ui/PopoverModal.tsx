import React, { ReactNode, useMemo } from "react";
import { Modal, Pressable, View, StyleSheet, Dimensions, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useModalPosition } from "@/hooks/useModalPosition";

type PopoverModalProps = {
 visible: boolean;
 onClose: () => void;
 position: { top: number; left: number };
 size?: { width: number; height: number | undefined };
 children: ReactNode;
 bottomTabOffset?: number;
}

const Header = ({ children }: { children: ReactNode }) => (
  <View style={styles.header as StyleProp<ViewStyle>}>{children}</View>
);

const Content = ({ children }: { children: ReactNode }) => (
  <View style={styles.content as StyleProp<ViewStyle>}>{children}</View>
);

const Footer = ({ children }: { children: ReactNode }) => (
  <View style={styles.footer as StyleProp<ViewStyle>}>{children}</View>
);

export const PopoverModal = ({ 
  visible, 
  onClose, 
  position, 
  size, 
  children, 
  bottomTabOffset = 70
}: PopoverModalProps) => {
  const { theme } = useTheme();
  const windowHeight = Dimensions.get("window").height;
  
  const basePosition = useModalPosition(position, size);
  
  const adjustedPosition = useMemo(() => {
    const maxModalHeight = size?.height || 400;
    const bottomPosition = basePosition.top + maxModalHeight;
    const availableScreenHeight = windowHeight - bottomTabOffset;
    
    if (bottomPosition > availableScreenHeight) {
      return {
        top: Math.max(50, availableScreenHeight - maxModalHeight),
        left: basePosition.left
      };
    }
    
    return basePosition;
  }, [basePosition, windowHeight, size, bottomTabOffset]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay as StyleProp<ViewStyle>} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.container as StyleProp<ViewStyle>,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              { top: adjustedPosition.top, left: adjustedPosition.left },
              size && { width: size.width, maxHeight: size.height },
            ]}
          >
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  container: {
    position: "absolute",
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 0.5,
    zIndex: 5,
    maxHeight: "80%",
  },
  header: {
    borderBottomWidth: 0.5,
  },
  content: {},
  footer: {
    borderTopWidth: 0.5,
  }
});

PopoverModal.Header = Header;
PopoverModal.Content = Content;
PopoverModal.Footer = Footer;
