import React, { useState } from "react";
import { StyleSheet, View as RNView, Platform } from "react-native";
import { View } from "@/components/ui/Themed";
import { ScrollView } from "@/components/ui/ScrollView";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Alert } from "@/components/ui/Alert";
import { DismissKeyboard } from "@/components/ui/DismissKeyboard";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { PopoverTrigger } from "@/components/ui/PopoverTrigger";
import { PopoverModal } from "@/components/ui/PopoverModal";
import { SansSerifText, SerifText, SansSerifBoldText, SerifBoldText } from "@/components/ui/StyledText";
import { PressableDefault } from "@/components/ui/PressableDefault";
import { useTheme } from "@/hooks/useTheme";

function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <SansSerifText style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : (scheme === "dark" ? "Dark" : "Light")}
      </SansSerifText>
      <Button
        title={`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"}`}
        onPress={toggleTheme}
        style={styles.themeToggleButton}
      />
    </View>
  );
}

export default function Index() {
  const { theme } = useTheme();
  const [textValue, setTextValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [toggleEnabled, setToggleEnabled] = useState(false);

  const showAlert = () => {
    Alert.show({
      title: "Confirm Action",
      message: "Are you sure you want to proceed?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "OK", onPress: () => console.log("OK Pressed") }
      ]
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <SansSerifBoldText style={styles.header}>UI Component Showcase</SansSerifBoldText>
          <ThemeToggle />
        </View>

        {/* Typography Section */}
        <ComponentSection title="Typography">
          <View style={styles.typographyContainer}>
            <SansSerifText>Sans Serif Text</SansSerifText>
            <SansSerifBoldText>Sans Serif Bold Text</SansSerifBoldText>
            <SerifText>Serif Text</SerifText>
            <SerifBoldText>Serif Bold Text</SerifBoldText>
          </View>
        </ComponentSection>

        {/* Button Section */}
        <ComponentSection title="Buttons">
          <View style={styles.buttonContainer}>
            <Button title="Default Button" onPress={() => console.log("Default button pressed")} />
            <View style={styles.spacer} />

            <Button title="Primary Button"
              variant="primary"
              onPress={() => console.log("Primary button pressed")} />
            <View style={styles.spacer} />

            <Button title="Outline Button"
              variant="outline"
              onPress={() => console.log("Outline button pressed")} />
            <View style={styles.spacer} />

            <View style={styles.rowContainer}>
              <Button title="Small"
                onPress={() => console.log("Small button pressed")}
                style={styles.inlineButton} />
              <Button title="Medium"
                onPress={() => console.log("Medium button pressed")}
                style={styles.inlineButton} />
              <Button title="Large"
                onPress={() => console.log("Large button pressed")}
                style={styles.inlineButton} />
            </View>
            <View style={styles.spacer} />

            <Button title="Disabled Button"
              disabled
              onPress={() => console.log("This won't execute")} />
            <View style={styles.spacer} />
          </View>
        </ComponentSection>

        {/* Text Input Section */}
        <ComponentSection title="Text Inputs">
          <DismissKeyboard>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Regular Text Input"
                value={textValue}
                onChangeText={setTextValue}
                style={styles.input}
              />

              <TextInput
                placeholder="Password Input"
                value={passwordValue}
                onChangeText={setPasswordValue}
                secureTextEntry
                showSecureEntryToggle
                style={styles.input}
              />

              <TextInput
                placeholder="Multi-line Text Input"
                multiline
                numberOfLines={3}
                style={[styles.input, styles.multilineInput]}
              />

              <TextInput
                placeholder="Numeric Input"
                inputMode="numeric"
                style={styles.input}
              />

              <TextInput
                placeholder="With Label"
                label="Input Label"
                style={styles.input}
              />
            </View>
          </DismissKeyboard>
        </ComponentSection>

        {/* Toggles and Switches */}
        <ComponentSection title="Toggles & Switches">
          <View style={styles.toggleContainer}>
            <RNView style={styles.toggleRow}>
              <SansSerifText>Toggle Switch:</SansSerifText>
              <ToggleSwitch
                enabled={toggleEnabled}
                setEnabled={setToggleEnabled}
              />
            </RNView>

            <RNView style={styles.toggleRow}>
              <SansSerifText>Toggle with Labels:</SansSerifText>
              <ToggleSwitch
                enabled={toggleEnabled}
                setEnabled={setToggleEnabled}
                labelOn="ON"
                labelOff="OFF"
              />
            </RNView>
          </View>
        </ComponentSection>

        {/* Alert Dialog */}
        <ComponentSection title="Alert Dialog">
          <View style={styles.alertContainer}>
            <Button
              title="Show Alert Dialog"
              onPress={showAlert}
              style={styles.alertButton}
            />
          </View>
        </ComponentSection>

        {/* Popovers */}
        <ComponentSection title="Popovers">
          <View style={styles.popoverContainer}>
            <PopoverTrigger
              trigger={({ onPress }) => (
                <Button
                title="Bottom"
                  onPress={onPress}
                  style={styles.popoverButton}
                />
              )}
              preferredPosition="bottom"
              popoverWidth={220}
              popoverHeight={200}
              popover={({ visible, position, onClose }) => (
                <PopoverModal
                  visible={visible}
                  onClose={onClose}
                  position={position}
                  size={{ width: 220, height: 200 }}
                >
                  <PopoverModal.Header>
                    <View style={styles.popoverHeader}>
                      <SansSerifBoldText>Positioned Popover</SansSerifBoldText>
                    </View>
                  </PopoverModal.Header>
                  <PopoverModal.Content>
                    <View>
                      <SansSerifText>This popover uses the PopoverTrigger component which handles position calculations automatically.</SansSerifText>
                      <Button
                        title="Close"
                        onPress={onClose}
                        style={styles.popoverActionButton}
                      />
                    </View>
                  </PopoverModal.Content>
                </PopoverModal>
              )}
            />

            <View style={styles.spacer} />

            <PopoverTrigger
              trigger={({ onPress }) => (
                <Button
                  title="Top"
                  onPress={onPress}
                  style={styles.popoverButton}
                />
              )}
              preferredPosition="top"
              popoverWidth={220}
              popoverHeight={150}
              popover={({ visible, position, onClose }) => (
                <PopoverModal
                  visible={visible}
                  onClose={onClose}
                  position={position}
                  size={{ width: 220, height: 150 }}
                >
                  <PopoverModal.Content>
                    <View>
                      <SansSerifText>This popover is positioned above the trigger.</SansSerifText>
                      <Button
                        title="Close"
                        onPress={onClose}
                        style={styles.popoverActionButton}
                      />
                    </View>
                  </PopoverModal.Content>
                </PopoverModal>
              )}
            />

            <View style={styles.spacer} />

            <View style={styles.popoverDirectionRow}>
              <PopoverTrigger
                trigger={({ onPress }) => (
                  <Button
                    title="Left"
                    onPress={onPress}
                    style={styles.directionButton}
                  />
                )}
                preferredPosition="top"
                popoverWidth={180}
                popoverHeight={120}
                popover={({ visible, position, onClose }) => (
                  <PopoverModal
                    visible={visible}
                    onClose={onClose}
                    position={position}
                    size={{ width: 180, height: 120 }}
                  >
                    <PopoverModal.Content>
                      <View>
                        <SansSerifText>Left positioned popover</SansSerifText>
                        <Button
                          title="Close"
                          onPress={onClose}
                          style={styles.popoverActionButton}
                        />
                      </View>
                    </PopoverModal.Content>
                  </PopoverModal>
                )}
              />

              <PopoverTrigger
                trigger={({ onPress }) => (
                  <Button
                    title="Right"
                    onPress={onPress}
                    style={styles.directionButton}
                  />
                )}
                preferredPosition="top"
                popoverWidth={180}
                popoverHeight={120}
                popover={({ visible, position, onClose }) => (
                  <PopoverModal
                    visible={visible}
                    onClose={onClose}
                    position={position}
                    size={{ width: 180, height: 120 }}
                  >
                    <PopoverModal.Content>
                      <View>
                        <SansSerifText>Right positioned popover</SansSerifText>
                        <Button
                          title="Close"
                          onPress={onClose}
                          style={styles.popoverActionButton}
                        />
                      </View>
                    </PopoverModal.Content>
                  </PopoverModal>
                )}
              />
            </View>
          </View>
        </ComponentSection>

        {/* Pressable Components */}
        <ComponentSection title="Pressable Components">
          <View style={styles.pressableContainer}>
            <PressableDefault
              onPress={() => Alert.show({ title: "Pressed", message: "You pressed the button!" })}
              style={[styles.pressableExample, { backgroundColor: theme.colors.card }]}
            >
              <SansSerifText>Press Me</SansSerifText>
            </PressableDefault>
          </View>
        </ComponentSection>
      </View>
    </ScrollView>
  );
}

interface ComponentSectionProps {
  title: string;
  children: React.ReactNode;
}

function ComponentSection({ title, children }: ComponentSectionProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <SansSerifBoldText style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        {title}
      </SansSerifBoldText>
      <View style={[styles.sectionContent, { borderColor: theme.colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 300,
  },
  container: {
    flex: 1,
    padding: 16,
    maxWidth: Platform.OS === "web" ? 600 : "100%",
    width: "100%",
    alignSelf: "center",
  },
  headerContainer: {
    flexDirection: "column",
    marginBottom: 20,
    alignItems: "center",
  },
  header: {
    fontSize: 24,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  themeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  themeToggleLabel: {
    marginRight: 10,
  },
  themeToggleButton: {
    minWidth: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  sectionContent: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  spacer: {
    height: 12,
  },
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inlineButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  typographyContainer: {
    gap: 8,
  },
  buttonContainer: {
    width: "100%",
  },
  inputContainer: {
    width: "100%",
    gap: 12,
  },
  input: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
  },
  toggleContainer: {
    width: "100%",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  alertContainer: {
    width: "100%",
  },
  alertButton: {
    marginBottom: 12,
  },
  notificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notificationButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  popoverContainer: {
    alignItems: "center",
  },
  popoverButton: {
    width: 200,
    marginBottom: 8,
  },
  popoverDirectionRow: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    gap: 12,
  },
  directionButton: {
    width: 100,
  },
  popoverHeader: {
    padding: 10,
  },
  popoverActionButton: {
    marginTop: 0,
  },
  pressableContainer: {
    alignItems: "center",
  },
  pressableExample: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
});
