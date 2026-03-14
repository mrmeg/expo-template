import React from "react";
import { Alert, Platform } from "react-native";
import { ProfileScreen, type ProfileStat, type ProfileAction, type ProfileSection } from "@/client/components/screens";

export default function ScreenProfileDemo() {
  const showAlert = (msg: string) => {
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert(msg);
    }
  };

  const stats: ProfileStat[] = [
    { icon: "star", value: "4.9", label: "Rating" },
    { icon: "briefcase", value: "142", label: "Projects" },
    { icon: "users", value: "1.2K", label: "Followers" },
  ];

  const actions: ProfileAction[] = [
    { label: "Edit Profile", icon: "edit-2", preset: "default", onPress: () => showAlert("Edit Profile") },
    { label: "Share", icon: "share", preset: "outline", onPress: () => showAlert("Share") },
  ];

  const sections: ProfileSection[] = [
    {
      title: "Contact",
      items: [
        { icon: "mail", label: "Email", value: "alex@example.com" },
        { icon: "phone", label: "Phone", value: "+1 (555) 123-4567" },
        { icon: "map-pin", label: "Location", value: "San Francisco, CA" },
      ],
    },
    {
      title: "Settings",
      items: [
        { icon: "bell", label: "Notifications", onPress: () => showAlert("Notifications") },
        { icon: "shield", label: "Privacy", onPress: () => showAlert("Privacy") },
        { icon: "help-circle", label: "Help & Support", onPress: () => showAlert("Help") },
      ],
    },
  ];

  return (
    <ProfileScreen
      name="Alex Rivera"
      subtitle="Senior Product Designer"
      badge="Pro Member"
      stats={stats}
      actions={actions}
      sections={sections}
    />
  );
}
