import { useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Settings } from "lucide-react-native";
import { Card, ItemGroup, Item, ItemTitle } from "@mrmeg/expo-ui/components";
import { signOut } from "@/client/auth";

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [dark, setDark] = useState(false);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You will need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Card>
        <ItemGroup title="Preferences">
          <Item>
            <Settings size={18} />
            <ItemTitle>Dark theme</ItemTitle>
            <Switch value={dark} onValueChange={setDark} />
          </Item>
          <Item>
            <ItemTitle>Notifications</ItemTitle>
            <Switch value={notifications} onValueChange={setNotifications} />
          </Item>
        </ItemGroup>
      </Card>
      <Pressable onPress={confirmSignOut}>
        <Text style={{ color: "red" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
