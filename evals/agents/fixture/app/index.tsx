import { View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components";

export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <StyledText>Eval App</StyledText>
    </View>
  );
}
