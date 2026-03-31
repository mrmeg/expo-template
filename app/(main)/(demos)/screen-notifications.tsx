import React, { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";
import {
  NotificationListScreen,
  type NotificationItem,
} from "@/client/screens/NotificationListScreen";

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: "1", icon: "message-circle", title: "New comment", body: "Alice replied to your post about the design system update.", timestamp: hoursAgo(0.5), read: false },
  { id: "2", icon: "user-plus", title: "New follower", body: "Bob started following you.", timestamp: hoursAgo(2), read: false },
  { id: "3", icon: "heart", title: "Post liked", body: "Carol liked your photo from the team offsite.", timestamp: hoursAgo(4), read: true },
  { id: "4", icon: "bell", title: "Reminder", body: "Your weekly standup starts in 15 minutes.", timestamp: hoursAgo(6), read: true },
  { id: "5", icon: "download", title: "Export ready", body: "Your CSV export has finished processing and is ready to download.", timestamp: hoursAgo(20), read: false },
  { id: "6", icon: "star", title: "Achievement unlocked", body: "You completed 10 tasks this week. Great job!", timestamp: daysAgo(1), read: true },
  { id: "7", icon: "shield", title: "Security alert", body: "A new device signed into your account from San Francisco.", timestamp: daysAgo(1), read: false },
  { id: "8", icon: "mail", title: "Message received", body: "Dave sent you a direct message about the project deadline.", timestamp: daysAgo(3), read: true },
  { id: "9", icon: "calendar", title: "Event tomorrow", body: "Team lunch at Olive Garden is scheduled for noon.", timestamp: daysAgo(4), read: true },
  { id: "10", icon: "git-pull-request", title: "PR approved", body: "Your pull request #142 was approved by two reviewers.", timestamp: daysAgo(5), read: true },
];

export default function ScreenNotificationsDemo() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const showAlert = (msg: string) => {
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert(msg);
    }
  };

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationPress = useCallback(
    (notification: NotificationItem) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      showAlert(notification.title);
    },
    []
  );

  return (
    <NotificationListScreen
      notifications={notifications}
      onNotificationPress={handleNotificationPress}
      onMarkAllRead={handleMarkAllRead}
      emptyDescription="You have no notifications right now."
    />
  );
}
