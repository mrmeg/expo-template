---
components: [Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions]
also: [ItemGroup]
use-for: "List / settings rows with density tokens; a pressable row takes `accessibilityLabel` / `Hint` / `accessibilityActions`, `testID`, `ref`; `ItemGroup`: A titled group of full-width `Item` rows with inset hairlines and an optional footer"
instead-of: "Hand-rolled row `View`s; `ItemGroup`: Bordered or shadowed boxes around rows, a `Card` per row, hand-drawn dividers"
---

# Item

Applies the row density tokens and a 44px native hit area (40px on web). A pressable row (`onPress`) is one button and takes `accessibilityLabel`, `accessibilityHint`, `accessibilityActions`, `onAccessibilityAction`, `testID` and `ref`; hint and actions are native-only. A static row takes `testID` and `ref` and ignores the accessibility props.

`ItemGroup` props: `title`, `description`, `footer`, `style`, `testID`. Draws inset hairlines between rows; no border, fill, or horizontal padding, so the parent must not pad either.

## Minimal Examples

A flat settings screen: groups of full-width rows, one 16 pt inset, a capped
column on wide screens, no boxes.

```tsx
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Switch,
} from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";

export function SettingsScreen({ onEditProfile, onSignOut }: { onEditProfile: () => void; onSignOut: () => void }) {
  const [push, setPush] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ItemGroup title="Account">
        <Item onPress={onEditProfile}>
          <ItemMedia icon="user" />
          <ItemContent>
            <ItemTitle>Edit profile</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" size={18} color="mutedForeground" />
          </ItemActions>
        </Item>
        <Item>
          <ItemMedia icon="bell" />
          <ItemContent>
            <ItemTitle>Push notifications</ItemTitle>
            <ItemDescription>Replies and mentions</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch checked={push} onCheckedChange={setPush} />
          </ItemActions>
        </Item>
      </ItemGroup>

      <ItemGroup title="About" footer="Version 1.4.0">
        <Item>
          <ItemContent>
            <ItemTitle>Build</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ItemDescription>2026.09.25</ItemDescription>
          </ItemActions>
        </Item>
      </ItemGroup>

      {/* Not rows, so it pads its own wrapper to the same 16 pt gutter. */}
      <View style={styles.gutter}>
        <Button preset="destructive" fullWidth text="Sign out" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // No horizontal padding: the rows carry the screen's inset.
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingVertical: spacing.md,
    gap: spacing.sectionSpacing,
  },
  gutter: {
    paddingHorizontal: spacing.screenPadding,
  },
});
```
