import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar } from "@mrmeg/expo-ui/components/Avatar";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

import { useLookDisplay, type SampleScreen } from "./context";
import { ActionButton, ListPanel, MockTabBar, SampleFrame, ScreenHeader, SectionLabel } from "./parts";

const APPEARANCE = ["System", "Light", "Dark"];
const APPEARANCE_WIDTH = 216;

/** The Settings sample: account header, profile fields, preference rows, actions, a tab bar. */
export function SettingsSample({ framed, onNavigate }: { framed: boolean; onNavigate?: (screen: SampleScreen) => void }) {
  const { theme } = useTheme();
  const display = useLookDisplay();
  const [name, setName] = useState("Ada Lovelace");
  const [email, setEmail] = useState("hello@terlo.app");
  const [notifications, setNotifications] = useState(true);
  const [digest, setDigest] = useState(false);
  const [appearance, setAppearance] = useState("System");

  return (
    <SampleFrame screen="settings" framed={framed}>
      <View style={framed ? styles.fill : undefined}>
        <ScreenHeader n={3} eyebrow="Account" title="Settings" />

        <View style={styles.body}>
          <View style={[styles.gutter, styles.account]}>
            <Avatar name={name} size={48} />
            <View style={styles.accountText}>
              <StyledText size="body" fontWeight="semibold" numberOfLines={1}>
                {name}
              </StyledText>
              <StyledText size="base" style={{ color: theme.colors.textDim }} numberOfLines={1}>
                {email}
              </StyledText>
            </View>
            <Badge variant="outline" text="Pro" />
          </View>

          <View style={[styles.gutter, styles.fields]}>
            <SectionLabel n={4}>Profile</SectionLabel>
            <TextInput label="Display name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              helperText="We never share it."
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.gutter}>
              <SectionLabel n={5}>Preferences</SectionLabel>
            </View>
            <ListPanel>
              <ItemGroup>
                <Item>
                  <ItemContent>
                    <ItemTitle>Notifications</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Switch checked={notifications} onCheckedChange={setNotifications} />
                  </ItemActions>
                </Item>
                <Item>
                  <ItemContent>
                    <ItemTitle>Weekly digest</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Switch checked={digest} onCheckedChange={setDigest} />
                  </ItemActions>
                </Item>
                <Item>
                  <ItemContent>
                    <ItemTitle>Appearance</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <View style={styles.appearance}>
                      <SegmentedControl
                        values={APPEARANCE}
                        value={appearance}
                        onValueChange={setAppearance}
                        tintColor={display.segmentTint === "primary" ? theme.colors.primary : undefined}
                      />
                    </View>
                  </ItemActions>
                </Item>
              </ItemGroup>
            </ListPanel>
          </View>

          <View style={[styles.gutter, styles.actions]}>
            <View style={styles.buttonRow}>
              <ActionButton text="Save changes" size="sm" onPress={() => {}} />
              <ActionButton text="Cancel" preset="outline" size="sm" onPress={() => {}} />
            </View>
            <ActionButton text="Delete account" preset="ghost" size="sm" color={theme.colors.destructive} onPress={() => {}} />
          </View>
        </View>

        {framed ? <View style={styles.spacer} /> : <View style={styles.tabGap} />}
        <MockTabBar active="settings" onNavigate={onNavigate} />
      </View>
    </SampleFrame>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { gap: spacing.lg, paddingTop: spacing.md },
  gutter: { paddingHorizontal: spacing.screenPadding },
  account: { flexDirection: "row", alignItems: "center", gap: spacing.smd },
  accountText: { flex: 1, minWidth: 0 },
  fields: { gap: spacing.smd },
  section: { gap: spacing.xs },
  appearance: { width: APPEARANCE_WIDTH },
  actions: { alignItems: "flex-start", gap: spacing.smd },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  spacer: { flex: 1 },
  tabGap: { height: spacing.lg },
});
