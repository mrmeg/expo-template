import React, { useState } from "react";
import { StyleSheet, View as RNView, Platform, TouchableOpacity } from "react-native";
import { View } from "@/components/ui/Themed";
import { ScrollView } from "@/components/ui/ScrollView";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Alert } from "@/components/ui/Alert";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { SansSerifText, SerifText, SansSerifBoldText, SerifBoldText } from "@/components/ui/StyledText";
import { useTheme } from "@/hooks/useTheme";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody, usePopover } from "@/components/ui/Popover";

function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <SansSerifText style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : (scheme === "dark" ? "Dark" : "Light")}
      </SansSerifText>
      <Button
        onPress={toggleTheme}
        style={styles.themeToggleButton}
      >
        <SansSerifBoldText style={styles.themeToggleButtonText}>
          {`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"}`}
        </SansSerifBoldText>
      </Button>
    </View>
  );
}

const TestPopoverContent: React.FC = () => {
  const { close } = usePopover();
  const { theme } = useTheme();

  const handleItemPress = (action: () => void) => {
    action();
    close();
  };

  return (
    <PopoverBody style={[styles.popoverContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <SansSerifText style={[styles.popoverItemText, { color: theme.colors.text }]}>Test Item 1</SansSerifText>
      <SansSerifText style={[styles.popoverItemText, { color: theme.colors.text }]}>Test Item 2</SansSerifText>
      <Button
        onPress={() => handleItemPress(() => console.log("Closed"))}
        style={styles.popoverActionButton}
      >
        <SansSerifText style={styles.popoverActionButtonText}>
          Close Popover
        </SansSerifText>
      </Button>
    </PopoverBody>
  );
};


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
            <Button onPress={() => console.log("Default button pressed")}>
              <SansSerifBoldText style={styles.buttonText}>
                Default Button
              </SansSerifBoldText>
            </Button>
            <View style={styles.spacer} />

            <Button
              variant="primary"
              onPress={() => console.log("Primary button pressed")}
            >
              <SansSerifBoldText style={[styles.buttonText, { color: "white" }]}>
                Primary Button
              </SansSerifBoldText>
            </Button>
            <View style={styles.spacer} />

            <Button
              variant="outline"
              onPress={() => console.log("Outline button pressed")}
            >
              <SansSerifBoldText style={[styles.buttonText, { color: theme.colors.primary }]}>
                Outline Button
              </SansSerifBoldText>
            </Button>
            <View style={styles.spacer} />

            <View style={styles.rowContainer}>
              <Button
                onPress={() => console.log("Small button pressed")}
                style={styles.inlineButton}
              >
                <SansSerifBoldText style={styles.buttonText}>
                  Small
                </SansSerifBoldText>
              </Button>
              <Button
                onPress={() => console.log("Medium button pressed")}
                style={styles.inlineButton}
              >
                <SansSerifBoldText style={styles.buttonText}>
                  Medium
                </SansSerifBoldText>
              </Button>
              <Button
                onPress={() => console.log("Large button pressed")}
                style={styles.inlineButton}
              >
                <SansSerifBoldText style={styles.buttonText}>
                  Large
                </SansSerifBoldText>
              </Button>
            </View>
            <View style={styles.spacer} />

            <Button
              disabled
              onPress={() => console.log("This won't execute")}
            >
              <SansSerifBoldText style={[styles.buttonText, { color: theme.colors.text, opacity: 0.6 }]}>
                Disabled Button
              </SansSerifBoldText>
            </Button>
            <View style={styles.spacer} />
          </View>
        </ComponentSection>

        {/* Text Input Section */}
        <ComponentSection title="Text Inputs">
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
              onPress={showAlert}
              style={styles.alertButton}
            >
              <SansSerifBoldText style={styles.buttonText}>
                Show Alert Dialog
              </SansSerifBoldText>
            </Button>
          </View>
        </ComponentSection>

        {/* Popovers */}
        <ComponentSection title="Popovers">
          <View style={styles.popoverContainer}>
            <Popover placement="bottom" offset={4}>
              <PopoverTrigger asChild>
                <TouchableOpacity
                  style={[styles.testPopoverButton, { backgroundColor: theme.colors.primary }]}
                >
                  <SansSerifBoldText style={styles.testPopoverButtonText}>
                    Test Popover
                  </SansSerifBoldText>
                </TouchableOpacity>
              </PopoverTrigger>
              <PopoverContent width={220}>
                <TestPopoverContent />
              </PopoverContent>
            </Popover>
          </View>
        </ComponentSection>

        {/* Pressable Components */}
        <ComponentSection title="Pressable Components">
          <View style={styles.pressableContainer}>
            <TouchableOpacity
              onPress={() => Alert.show({ title: "Pressed", message: "You pressed the button!" })}
              style={[styles.pressableExample, { backgroundColor: theme.colors.card }]}
            >
              <SansSerifText>Press Me</SansSerifText>
            </TouchableOpacity>
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
  menuItems: {
    paddingVertical: 8,
  },
  popoverContent: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  popoverItemText: {
    fontSize: 14,
    fontWeight: "500",
    padding: 8,
  },
  testPopoverButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  testPopoverButtonText: {
    color: "white",
    fontSize: 16,
  },
  themeToggleButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  popoverActionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
