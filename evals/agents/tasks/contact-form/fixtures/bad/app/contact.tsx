import { useState } from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import { Send } from "lucide-react-native";
import { Card, TextInput as FormInput } from "@mrmeg/expo-ui/components";
import { submitContact } from "@/client/api/contact";

function Toast({ text }: { text: string }) {
  return (
    <Animated.View>
      <Text>{text}</Text>
    </Animated.View>
  );
}

export default function ContactScreen() {
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Card>
        <TextInput value={name} onChangeText={setName} placeholder="Name" />
        <FormInput label="Email" />
        <Pressable
          onPress={async () => {
            await submitContact({ name, email: "", message: "" });
            setSent(true);
          }}
        >
          <Send size={16} />
          <Text>Send</Text>
        </Pressable>
      </Card>
      {sent ? <Toast text="Sent" /> : null}
    </View>
  );
}
