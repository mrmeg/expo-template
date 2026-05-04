import React, { useMemo, useState, useCallback } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { ListScreen } from "@/client/screens/ListScreen";
import type { Theme } from "@mrmeg/expo-ui/constants";

interface Contact {
  id: string;
  name: string;
  role: string;
  icon: IconName;
  status: "online" | "offline" | "away";
}

const ALL_CONTACTS: Contact[] = [
  { id: "1", name: "Emma Wilson", role: "Engineering Lead", icon: "user", status: "online" },
  { id: "2", name: "James Chen", role: "Product Designer", icon: "user", status: "online" },
  { id: "3", name: "Sofia Rodriguez", role: "Frontend Developer", icon: "user", status: "away" },
  { id: "4", name: "Liam Patel", role: "Backend Engineer", icon: "user", status: "offline" },
  { id: "5", name: "Olivia Kim", role: "UX Researcher", icon: "user", status: "online" },
  { id: "6", name: "Noah Thompson", role: "DevOps Engineer", icon: "user", status: "offline" },
  { id: "7", name: "Ava Martinez", role: "Data Scientist", icon: "user", status: "away" },
  { id: "8", name: "Ethan Brown", role: "Mobile Developer", icon: "user", status: "online" },
];

const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  away: "#eab308",
  offline: "#94a3b8",
};

export default function ScreenListDemo() {
  const { theme, getShadowStyle } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [contacts, setContacts] = useState(ALL_CONTACTS);
  const [refreshing, setRefreshing] = useState(false);

  const handleSearch = useCallback((query: string) => {
    if (!query) {
      setContacts(ALL_CONTACTS);
      return;
    }
    const lower = query.toLowerCase();
    setContacts(
      ALL_CONTACTS.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.role.toLowerCase().includes(lower)
      )
    );
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setContacts(ALL_CONTACTS);
      setRefreshing(false);
    }, 1000);
  }, []);

  const renderItem = (item: Contact) => (
    <Pressable
      style={Platform.OS === "web" ? { ...styles.contactRow, cursor: "pointer" as any } : styles.contactRow}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Icon name={item.icon} size={20} color={theme.colors.primary} />
        </View>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
      </View>

      <View style={styles.contactInfo}>
        <SansSerifBoldText style={styles.contactName}>{item.name}</SansSerifBoldText>
        <SansSerifText style={styles.contactRole}>{item.role}</SansSerifText>
      </View>

      <Badge variant={item.status === "online" ? "outline" : "secondary"}>
        {item.status}
      </Badge>
    </Pressable>
  );

  return (
    <ListScreen
      data={contacts}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      searchable
      searchPlaceholder="Search contacts..."
      onSearch={handleSearch}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      emptyIcon="users"
      emptyTitle="No contacts found"
      emptyDescription="Try adjusting your search to find what you're looking for."
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    avatarContainer: {
      position: "relative",
      marginRight: spacing.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    statusDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    contactInfo: {
      flex: 1,
    },
    contactName: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    contactRole: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      marginTop: 2,
    },
  });
