import React from "react";
import { View, Alert, Platform, StyleSheet } from "react-native";
import * as z from "zod/mini";
import { useForm, zodResolver, FormTextInput, FormCheckbox } from "@/client/lib/form";
import { FormScreen, type FormStep } from "./Screen";
import { spacing } from "@mrmeg/expo-ui/constants";

// zod/mini's function-style API tree-shakes to a fraction of classic zod's
// bundle weight; classic `import { z } from "zod"` pulls the full method-chain
// build (~360 KB raw) into this route's chunk.
const formSchema = z.object({
  name: z.string().check(z.minLength(1, "Name is required")),
  email: z.string().check(
    z.minLength(1, "Email is required"),
    z.regex(z.regexes.email, "Enter a valid email")
  ),
  city: z.string().check(z.minLength(1, "City is required")),
  country: z.string().check(z.minLength(1, "Country is required")),
  newsletter: z.optional(z.boolean()),
});

type FormData = z.infer<typeof formSchema>;

const handleSubmit = (data: FormData) => {
  const summary = JSON.stringify(data, null, 2);
  if (Platform.OS === "web") {
    window.alert(summary);
  } else {
    Alert.alert("Form Submitted", summary);
  }
};

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
