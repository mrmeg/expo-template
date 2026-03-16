import React, { useState } from "react";
import { Alert, Platform } from "react-native";
import { SettingsScreen, type SettingsSection } from "@/client/screens";

export default function ScreenSettingsDemo() {
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [quality, setQuality] = useState("high");

  const showAlert = (msg: string) => {
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert(msg);
    }
  };

  const sections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        { type: "navigate", icon: "user", label: "Edit Profile", onPress: () => showAlert("Edit Profile") },
        { type: "navigate", icon: "lock", label: "Change Password", onPress: () => showAlert("Change Password") },
        { type: "navigate", icon: "shield", label: "Privacy", value: "Public", onPress: () => showAlert("Privacy") },
      ],
    },
    {
      title: "Preferences",
      items: [
        { type: "toggle", icon: "bell", label: "Notifications", value: notifications, onValueChange: setNotifications },
        { type: "toggle", icon: "lock", label: "Biometric Login", value: biometrics, onValueChange: setBiometrics },
        { type: "toggle", icon: "refresh-cw", label: "Auto-Update", value: autoUpdate, onValueChange: setAutoUpdate },
      ],
      footer: "Receive push notifications for important updates.",
    },
    {
      title: "Streaming Quality",
      items: [
        {
          type: "select",
          icon: "sliders",
          label: "Quality",
          options: [
            { value: "low", label: "Low (360p)" },
            { value: "medium", label: "Medium (720p)" },
            { value: "high", label: "High (1080p)" },
          ],
          selectedValue: quality,
          onSelect: setQuality,
        },
      ],
    },
    {
      title: "About",
      items: [
        { type: "info", icon: "info", label: "Version", value: "2.1.0" },
        { type: "info", label: "Build", value: "2025.03.14" },
      ],
    },
    {
      title: "Danger Zone",
      items: [
        { type: "destructive", icon: "trash-2", label: "Delete Account", onPress: () => showAlert("Delete Account?") },
      ],
    },
  ];

  return <SettingsScreen sections={sections} />;
}
