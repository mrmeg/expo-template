import { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import {
  SansSerifText,
  SansSerifBoldText,
} from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { TextInput } from "@/client/components/ui/TextInput";
import { Checkbox } from "@/client/components/ui/Checkbox";
import { globalUIStore } from "@/client/stores/globalUIStore";
import type { Theme } from "@/client/constants/colors";

// Form field types
interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
}

// Validation rules
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  if (password.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("One number");
  return errors;
};

/**
 * Form validation demo screen.
 * Demonstrates common form validation patterns.
 */
export default function FormDemoScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  // Error state
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update field value
  const updateField = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Mark field as touched (for showing errors after blur)
  const handleBlur = useCallback((field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  }, [formData]);

  // Validate single field
  const validateField = useCallback((field: keyof FormData): boolean => {
    let error: string | undefined;

    switch (field) {
    case "name":
      if (!formData.name.trim()) {
        error = "Name is required";
      } else if (formData.name.trim().length < 2) {
        error = "Name must be at least 2 characters";
      }
      break;

    case "email":
      if (!formData.email.trim()) {
        error = "Email is required";
      } else if (!validateEmail(formData.email)) {
        error = "Please enter a valid email address";
      }
      break;

    case "password":
      if (!formData.password) {
        error = "Password is required";
      } else {
        const passwordErrors = validatePassword(formData.password);
        if (passwordErrors.length > 0) {
          error = `Password needs: ${passwordErrors.join(", ")}`;
        }
      }
      break;

    case "confirmPassword":
      if (!formData.confirmPassword) {
        error = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        error = "Passwords do not match";
      }
      break;

    case "agreeToTerms":
      if (!formData.agreeToTerms) {
        error = "You must agree to the terms";
      }
      break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  }, [formData]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const fields: (keyof FormData)[] = ["name", "email", "password", "confirmPassword", "agreeToTerms"];
    let isValid = true;

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    fields.forEach((field) => {
      allTouched[field] = true;
      if (!validateField(field)) {
        isValid = false;
      }
    });
    setTouched(allTouched);

    return isValid;
  }, [validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      globalUIStore.getState().show({
        type: "error",
        title: "Validation Error",
        messages: ["Please fix the errors before submitting"],
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);

    // Show success notification
    globalUIStore.getState().show({
      type: "success",
      title: "Form Submitted!",
      messages: [`Welcome, ${formData.name}!`, "Your account has been created."],
      duration: 4000,
    });

    // Reset form
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    });
    setErrors({});
    setTouched({});
  }, [validateForm, formData.name]);

  // Reset form
  const handleReset = useCallback(() => {
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    });
    setErrors({});
    setTouched({});
  }, []);

  // Get password strength
  const getPasswordStrength = (): { label: string; color: string; width: `${number}%` } => {
    if (!formData.password) return { label: "", color: theme.colors.muted, width: "0%" };
    const errors = validatePassword(formData.password);
    const score = 4 - errors.length;

    if (score <= 1) return { label: "Weak", color: theme.colors.destructive, width: "25%" };
    if (score === 2) return { label: "Fair", color: theme.colors.warning, width: "50%" };
    if (score === 3) return { label: "Good", color: theme.colors.primary, width: "75%" };
    return { label: "Strong", color: theme.colors.success, width: "100%" };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <SansSerifBoldText style={styles.title}>
              Form Validation Demo
            </SansSerifBoldText>
            <SansSerifText style={styles.subtitle}>
              Demonstrates client-side validation patterns
            </SansSerifText>
          </View>

          {/* Form */}
          <View style={[styles.form, getShadowStyle("subtle")]}>
            {/* Name Field */}
            <View style={styles.field}>
              <TextInput
                label="Full Name"
                placeholder="John Doe"
                value={formData.name}
                onChangeText={(value) => updateField("name", value)}
                onBlur={() => handleBlur("name")}
                autoCapitalize="words"
                autoComplete="name"
              />
              {touched.name && errors.name && (
                <SansSerifText style={styles.errorText}>{errors.name}</SansSerifText>
              )}
            </View>

            {/* Email Field */}
            <View style={styles.field}>
              <TextInput
                label="Email"
                placeholder="john@example.com"
                value={formData.email}
                onChangeText={(value) => updateField("email", value)}
                onBlur={() => handleBlur("email")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {touched.email && errors.email && (
                <SansSerifText style={styles.errorText}>{errors.email}</SansSerifText>
              )}
            </View>

            {/* Password Field */}
            <View style={styles.field}>
              <TextInput
                label="Password"
                placeholder="Enter a strong password"
                value={formData.password}
                onChangeText={(value) => updateField("password", value)}
                onBlur={() => handleBlur("password")}
                secureTextEntry
                autoComplete="new-password"
              />
              {formData.password && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        { width: passwordStrength.width, backgroundColor: passwordStrength.color },
                      ]}
                    />
                  </View>
                  <SansSerifText style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </SansSerifText>
                </View>
              )}
              {touched.password && errors.password && (
                <SansSerifText style={styles.errorText}>{errors.password}</SansSerifText>
              )}
            </View>

            {/* Confirm Password Field */}
            <View style={styles.field}>
              <TextInput
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChangeText={(value) => updateField("confirmPassword", value)}
                onBlur={() => handleBlur("confirmPassword")}
                secureTextEntry
                autoComplete="new-password"
              />
              {touched.confirmPassword && errors.confirmPassword && (
                <SansSerifText style={styles.errorText}>{errors.confirmPassword}</SansSerifText>
              )}
            </View>

            {/* Terms Checkbox */}
            <View style={styles.checkboxField}>
              <Checkbox
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => {
                  updateField("agreeToTerms", checked);
                  setTouched((prev) => ({ ...prev, agreeToTerms: true }));
                }}
              />
              <SansSerifText style={styles.checkboxLabel}>
                I agree to the Terms of Service and Privacy Policy
              </SansSerifText>
            </View>
            {touched.agreeToTerms && errors.agreeToTerms && (
              <SansSerifText style={styles.errorText}>{errors.agreeToTerms}</SansSerifText>
            )}

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Button
                preset="ghost"
                onPress={handleReset}
                style={styles.resetButton}
              >
                <SansSerifText style={styles.resetButtonText}>Reset</SansSerifText>
              </Button>
              <Button
                preset="default"
                onPress={handleSubmit}
                loading={isSubmitting}
                style={styles.submitButton}
              >
                <SansSerifBoldText style={styles.submitButtonText}>
                  Create Account
                </SansSerifBoldText>
              </Button>
            </View>
          </View>

          {/* Info section */}
          <View style={styles.infoSection}>
            <SansSerifBoldText style={styles.infoTitle}>
              Validation Features
            </SansSerifBoldText>
            <View style={styles.infoList}>
              <SansSerifText style={styles.infoItem}>
                • Real-time validation on blur
              </SansSerifText>
              <SansSerifText style={styles.infoItem}>
                • Password strength indicator
              </SansSerifText>
              <SansSerifText style={styles.infoItem}>
                • Password confirmation matching
              </SansSerifText>
              <SansSerifText style={styles.infoItem}>
                • Email format validation
              </SansSerifText>
              <SansSerifText style={styles.infoItem}>
                • Required field checking
              </SansSerifText>
              <SansSerifText style={styles.infoItem}>
                • Clear error messages
              </SansSerifText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    header: {
      paddingVertical: spacing.lg,
    },
    title: {
      fontSize: 24,
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },
    form: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    field: {
      marginBottom: spacing.md,
    },
    errorText: {
      color: theme.colors.destructive,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    strengthContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.xs,
      gap: spacing.sm,
    },
    strengthBar: {
      flex: 1,
      height: 4,
      backgroundColor: theme.colors.muted,
      borderRadius: 2,
      overflow: "hidden",
    },
    strengthFill: {
      height: "100%",
      borderRadius: 2,
    },
    strengthLabel: {
      fontSize: 12,
      fontWeight: "500",
      minWidth: 50,
    },
    checkboxField: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.foreground,
      lineHeight: 20,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    resetButton: {
      flex: 1,
    },
    resetButtonText: {
      color: theme.colors.mutedForeground,
    },
    submitButton: {
      flex: 2,
    },
    submitButtonText: {
      color: theme.colors.primaryForeground,
    },
    infoSection: {
      paddingVertical: spacing.xl,
    },
    infoTitle: {
      fontSize: 16,
      color: theme.colors.foreground,
      marginBottom: spacing.md,
    },
    infoList: {
      gap: spacing.xs,
    },
    infoItem: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },
  });
