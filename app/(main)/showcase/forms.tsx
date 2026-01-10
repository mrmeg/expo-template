import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { TextInput } from "@/client/components/ui/TextInput";
import { Switch } from "@/client/components/ui/Switch";
import { Checkbox } from "@/client/components/ui/Checkbox";
import { Toggle } from "@/client/components/ui/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/ToggleGroup";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import type { Theme } from "@/client/constants/colors";

export default function FormsShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Form state
  const [textValue, setTextValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [toggleValue, setToggleValue] = useState(false);
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(true);
  const [singleTogglePressed, setSingleTogglePressed] = useState(false);
  const [alignment, setAlignment] = useState<string | undefined>("left");
  const [formats, setFormats] = useState<string[]>(["bold"]);

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <Section title="Text Input">
            <SubSection label="Standard Input">
              <TextInput
                label="Username"
                placeholder="Enter your username..."
                value={textValue}
                onChangeText={setTextValue}
              />
            </SubSection>

            <SubSection label="Password Input">
              <TextInput
                label="Password"
                placeholder="Enter password..."
                secureTextEntry
                showSecureEntryToggle
                value={passwordValue}
                onChangeText={setPasswordValue}
              />
            </SubSection>
          </Section>

          <Section title="Switch">
            <SubSection label="Basic">
              <View style={styles.switchRow}>
                <StyledText style={styles.labelText}>Basic Switch</StyledText>
                <Switch checked={toggleValue} onCheckedChange={setToggleValue} />
              </View>
            </SubSection>

            <SubSection label="With Labels">
              <View style={styles.switchRow}>
                <StyledText style={styles.labelText}>Switch with Labels</StyledText>
                <Switch
                  size={{ width: 60, height: 32 }}
                  checked={toggleValue}
                  onCheckedChange={setToggleValue}
                  labelOn="ON"
                  labelOff="OFF"
                />
              </View>
            </SubSection>

            <SubSection label="Large Size">
              <View style={styles.switchRow}>
                <StyledText style={styles.labelText}>Large Switch</StyledText>
                <Switch
                  checked={toggleValue}
                  onCheckedChange={setToggleValue}
                  size={{ width: 70, height: 36 }}
                  thumbSize={32}
                  labelOn="YES"
                  labelOff="NO"
                />
              </View>
            </SubSection>
          </Section>

          <Section title="Checkbox">
            <SubSection>
              <View style={styles.checkboxRow}>
                <Checkbox checked={checkbox1} onCheckedChange={setCheckbox1} />
                <StyledText style={styles.labelText}>Checkbox Option 1</StyledText>
              </View>
              <View style={[styles.checkboxRow, { marginTop: spacing.md }]}>
                <Checkbox checked={checkbox2} onCheckedChange={setCheckbox2} />
                <StyledText style={styles.labelText}>Checkbox Option 2 (initially checked)</StyledText>
              </View>
            </SubSection>
          </Section>

          <Section title="Toggle">
            <SubSection label="Single Toggle">
              <Toggle pressed={singleTogglePressed} onPressedChange={setSingleTogglePressed}>
                <StyledText style={styles.labelText}>Toggle Me</StyledText>
              </Toggle>
            </SubSection>
          </Section>

          <Section title="Toggle Group">
            <SubSection label="Single Selection">
              <ToggleGroup type="single" value={alignment} onValueChange={setAlignment}>
                <ToggleGroupItem value="left">
                  <StyledText style={styles.labelText}>Left</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="center">
                  <StyledText style={styles.labelText}>Center</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="right">
                  <StyledText style={styles.labelText}>Right</StyledText>
                </ToggleGroupItem>
              </ToggleGroup>
            </SubSection>

            <SubSection label="Multiple Selection">
              <ToggleGroup type="multiple" value={formats} onValueChange={setFormats}>
                <ToggleGroupItem value="bold">
                  <StyledText style={[styles.labelText, { fontWeight: "bold" }]}>B</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="italic">
                  <StyledText style={[styles.labelText, { fontStyle: "italic" }]}>I</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="underline">
                  <StyledText style={[styles.labelText, { textDecorationLine: "underline" }]}>U</StyledText>
                </ToggleGroupItem>
              </ToggleGroup>
            </SubSection>

            <SubSection label="Outline Variant">
              <ToggleGroup type="single" variant="outline" value={alignment} onValueChange={setAlignment}>
                <ToggleGroupItem value="left">
                  <StyledText style={styles.labelText}>Left</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="center">
                  <StyledText style={styles.labelText}>Center</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="right">
                  <StyledText style={styles.labelText}>Right</StyledText>
                </ToggleGroupItem>
              </ToggleGroup>
            </SubSection>

            <SubSection label="Small Size">
              <ToggleGroup type="single" size="sm" value={alignment} onValueChange={setAlignment}>
                <ToggleGroupItem value="left">
                  <StyledText style={styles.labelText}>L</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="center">
                  <StyledText style={styles.labelText}>C</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="right">
                  <StyledText style={styles.labelText}>R</StyledText>
                </ToggleGroupItem>
              </ToggleGroup>
            </SubSection>
          </Section>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    content: {
      flex: 1,
      padding: spacing.md,
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
  });
