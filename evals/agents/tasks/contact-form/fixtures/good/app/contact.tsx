import { useState } from "react";
import { View } from "react-native";
import { Button, Screen, TextInput } from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";
import { notify } from "@mrmeg/expo-ui/state";
import { submitContact } from "@/client/api/contact";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [sending, setSending] = useState(false);

  async function onSubmit() {
    const next = {
      name: name.trim() ? undefined : "Enter your name",
      email: EMAIL.test(email) ? undefined : "Enter a valid email address",
      message: message.trim() ? undefined : "Enter a message",
    };
    setErrors(next);
    if (next.name || next.email || next.message) return;

    setSending(true);
    try {
      await submitContact({ name, email, message });
      notify.success("Message sent");
    } catch {
      notify.error("Could not send your message");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen edges={["bottom"]} scroll contentContainerStyle={{ gap: spacing.md }}>
      <TextInput label="Name" value={name} onChangeText={setName} errorText={errors.name} />
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        errorText={errors.email}
      />
      <TextInput label="Message" value={message} onChangeText={setMessage} multiline errorText={errors.message} />
      <View>
        <Button preset="default" fullWidth loading={sending} text="Send" onPress={onSubmit} />
      </View>
    </Screen>
  );
}
