import React from "react";
import { Alert, Platform } from "react-native";
import { WelcomeScreen } from "@/client/screens/WelcomeScreen";

function showAlert(msg: string) {
  if (Platform.OS === "web") {
    window.alert(msg);
  } else {
    Alert.alert(msg);
  }
}

export default function ScreenWelcomeDemo() {
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
