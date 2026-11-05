import { useState } from "react";
import { View } from "react-native";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
  Screen,
  Switch,
  ThemeSelector,
} from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";
import { signOut } from "@/client/auth";

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);

  return (
    <Screen edges={["bottom"]} scroll padded={false} contentContainerStyle={{ gap: spacing.sectionSpacing }}>
      <ItemGroup title="Appearance">
        <Item>
          <ItemContent>
            <ItemTitle>Theme</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ThemeSelector />
          </ItemActions>
        </Item>
      </ItemGroup>

      <ItemGroup title="Notifications">
        <Item>
          <ItemContent>
            <ItemTitle>Push notifications</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </ItemActions>
        </Item>
      </ItemGroup>

      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button preset="destructive" fullWidth text="Sign out" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You will need to sign in again to use the app.</AlertDialogDescription>
            <AlertDialogCancel asChild>
              <Button preset="outline" text="Cancel" />
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button preset="destructive" text="Sign out" onPress={() => void signOut()} />
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      </View>
    </Screen>
  );
}
