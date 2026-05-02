import React from "react";
import { View, Alert, Platform, StyleSheet } from "react-native";
import { z } from "zod";
import { useForm, zodResolver, FormTextInput, FormCheckbox } from "@/client/lib/form";
import { FormScreen, type FormStep } from "@/client/screens/FormScreen";
import { spacing } from "@mrmeg/expo-ui/constants";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  newsletter: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

const STEPS: FormStep[] = [
  {
    title: "Personal Info",
    description: "Let's start with your name and email address.",
    fields: ["name", "email"],
    content: (form) => (
      <View style={styles.fieldGroup}>
        <FormTextInput
          name="name"
          control={form.control}
          label="Full Name"
          placeholder="Jane Doe"
          autoCapitalize="words"
        />
        <FormTextInput
          name="email"
          control={form.control}
          label="Email"
          placeholder="jane@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
    ),
  },
  {
    title: "Location",
    description: "Where are you based?",
    fields: ["city", "country"],
    content: (form) => (
      <View style={styles.fieldGroup}>
        <FormTextInput
          name="city"
          control={form.control}
          label="City"
          placeholder="San Francisco"
        />
        <FormTextInput
          name="country"
          control={form.control}
          label="Country"
          placeholder="United States"
        />
      </View>
    ),
  },
  {
    title: "Preferences",
    description: "Almost done! Just one more thing.",
    fields: ["newsletter"],
    content: (form) => (
      <View style={styles.fieldGroup}>
        <FormCheckbox
          name="newsletter"
          control={form.control}
          label="Subscribe to our newsletter"
        />
      </View>
    ),
  },
];

export default function ScreenFormDemo() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      city: "",
      country: "",
      newsletter: false,
    },
  });

  const handleSubmit = (data: FormData) => {
    const summary = JSON.stringify(data, null, 2);
    if (Platform.OS === "web") {
      window.alert(summary);
    } else {
      Alert.alert("Form Submitted", summary);
    }
  };

  return (
    <FormScreen
      steps={STEPS}
      form={form}
      onSubmit={handleSubmit}
      submitLabel="Submit"
    />
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing.md,
  },
});
