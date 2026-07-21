import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { EyebrowText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { HeroScreen } from "./Screen";

function showAlert(msg: string) {
  if (Platform.OS === "web") {
    window.alert(msg);
  } else {
    Alert.alert(msg);
  }
}

export default function ScreenHeroDemo() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.label}>
        <EyebrowText>Centered</EyebrowText>
      </View>
      <View style={styles.centeredWrapper}>
        <HeroScreen
          layout="centered"
          eyebrow="New"
          title="Ship your app faster"
          description="A production-ready Expo template with authentication, theming, and a full component library included."
          primaryAction={{ label: "Get Started", onPress: () => showAlert("Get Started") }}
          secondaryAction={{ label: "Learn More", onPress: () => showAlert("Learn More") }}
          style={styles.centeredScreen}
        />
      </View>

      <View style={styles.label}>
        <EyebrowText>Full-bleed</EyebrowText>
      </View>
      <View style={styles.fullBleedWrapper}>
        <HeroScreen
          layout="fullBleed"
          eyebrow="Featured"
          title="Built for teams that ship"
          description="Everything you need to go from idea to production, wrapped in a design system that feels great out of the box."
          image={require("@/assets/images/partial-react-logo.png")}
          primaryAction={{ label: "Start free", onPress: () => showAlert("Start free") }}
          secondaryAction={{ label: "View demo", onPress: () => showAlert("View demo") }}
          style={styles.fullBleedScreen}
        />
      </View>
    </ScrollView>
  );
}

const HERO_PREVIEW_HEIGHT = 420;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  centeredWrapper: {
    height: HERO_PREVIEW_HEIGHT,
  },
  centeredScreen: {
    flex: 1,
  },
  fullBleedWrapper: {
    height: HERO_PREVIEW_HEIGHT,
    marginBottom: spacing.xl,
  },
  fullBleedScreen: {
    flex: 1,
  },
});
