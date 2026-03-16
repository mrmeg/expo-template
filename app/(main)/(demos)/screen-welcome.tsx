import React from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { WelcomeScreen } from "@/client/screens";

export default function ScreenWelcomeDemo() {
  const router = useRouter();

  const showAlert = (msg: string) => {
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert(msg);
    }
  };

  return (
    <WelcomeScreen
      title="Welcome to Acme"
      subtitle="The easiest way to build, ship, and grow your mobile app."
      logoIcon="hexagon"
      primaryAction={{
        label: "Create an Account",
        onPress: () => showAlert("Sign Up"),
      }}
      secondaryAction={{
        label: "I already have an account",
        onPress: () => showAlert("Sign In"),
      }}
      socialProviders={[
        { label: "Continue with Google", icon: "chrome", onPress: () => showAlert("Google") },
        { label: "Continue with GitHub", icon: "github", onPress: () => showAlert("GitHub") },
      ]}
      footerText="By continuing, you agree to our Terms of Service and Privacy Policy."
    />
  );
}
