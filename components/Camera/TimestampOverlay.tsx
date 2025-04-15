import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SansSerifText } from "@/components/ui/StyledText";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

interface TimestampOverlayProps {
  enabled: boolean;
  useCurrentDate?: boolean;
  customDate?: string;
  position?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
}

export default function TimestampOverlay({
  enabled,
  useCurrentDate = true,
  customDate,
  position = "topRight"
}: TimestampOverlayProps) {
  const [dateString, setDateString] = useState("");

  useEffect(() => {
    if (useCurrentDate) {
      // Update the timestamp every second
      const interval = setInterval(() => {
        const now = new Date();
        const month = now.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const day = now.getDate().toString().padStart(2, "0");
        const year = now.getFullYear().toString();
        const time = now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });

        setDateString(`${month} ${day} ${year} ${time}`);
      }, 1000);

      return () => clearInterval(interval);
    } else if (customDate) {
      setDateString(customDate);
    }
  }, [useCurrentDate, customDate]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(enabled ? 1 : 0)
    };
  });

  const positionStyle = (() => {
    switch(position) {
    case "topLeft": return styles.topLeft;
    case "topRight": return styles.topRight;
    case "bottomLeft": return styles.bottomLeft;
    case "bottomRight":
    default: return styles.bottomRight;
    }
  })();

  return (
    <Animated.View style={[styles.container, positionStyle, animatedStyle]}>
      <SansSerifText style={styles.text}>{dateString}</SansSerifText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 4,
    position: "absolute",
  },
  topLeft: {
    top: 40,
    left: 20,
  },
  topRight: {
    top: 40,
    right: 20,
  },
  bottomLeft: {
    bottom: 130,
    left: 20,
  },
  bottomRight: {
    bottom: 130,
    right: 20,
  },
  text: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "monospace",
  }
});
