import React, { Suspense, useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomSheet } from "@mrmeg/expo-ui/components/BottomSheet";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { hapticSuccess } from "@mrmeg/expo-ui/lib";
import { notify } from "@mrmeg/expo-ui/state";
import { useAuth } from "@/client/features/auth/hooks/useAuth";
import { isAuthError } from "@/client/features/auth/provider";

// The auth forms stay behind their one split point (see the barrel's note):
// this sheet loads the reset form only when a person opens it.
const ResetPasswordForm = React.lazy(async () => ({
  default: (await import("@/client/features/auth/components")).ResetPasswordForm,
}));

type Phase = "sending" | "code";

export interface ChangePasswordFlow {
  open: boolean;
  phase: Phase;
  error: string | undefined;
  submitting: boolean;
  /** Send the reset code and open the sheet. A row's `onPress`. */
  start: () => Promise<void>;
  submit: (params: { code: string; newPassword: string }) => Promise<void>;
  setOpen: (open: boolean) => void;
}

function describe(error: unknown, fallback: string): string {
  return isAuthError(error) && error.message ? error.message : fallback;
}

/**
 * Change Password while signed in, through the provider's reset flow: a code
 * goes to the account's email, and the auth screen's reset form collects it
 * with the new password. The `AuthGate` only renders the auth screen when
 * signed out, so the form is hosted here instead of routed to.
 */
export function useChangePassword(email: string | undefined): ChangePasswordFlow {
  const { forgotPassword, resetPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("sending");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const start = useCallback(async () => {
    if (!email) return;
    setOpen(true);
    setPhase("sending");
    setError(undefined);
    try {
      const result = await forgotPassword(email);
      if (result.status === "codeSent") {
        setPhase("code");
        return;
      }
      setOpen(false);
      notify({ type: "info", messages: ["Check your email to finish changing your password."], duration: 3000 });
    } catch (err) {
      setOpen(false);
      notify({ type: "error", messages: [describe(err, "We couldn't send a reset code. Try again.")], duration: 3000 });
    }
  }, [email, forgotPassword]);

  const submit = useCallback(
    async ({ code, newPassword }: { code: string; newPassword: string }) => {
      if (!email) return;
      setSubmitting(true);
      setError(undefined);
      try {
        await resetPassword({ email, code, newPassword });
        hapticSuccess();
        notify({ type: "success", messages: ["Password updated"], duration: 2000 });
        setOpen(false);
      } catch (err) {
        setError(describe(err, "We couldn't update your password. Check the code and try again."));
      } finally {
        setSubmitting(false);
      }
    },
    [email, resetPassword],
  );

  return { open, phase, error, submitting, start, submit, setOpen };
}

export interface ChangePasswordSheetProps {
  flow: ChangePasswordFlow;
  email: string;
}

export function ChangePasswordSheet({ flow, email }: ChangePasswordSheetProps) {
  const { theme } = useTheme();
  const pending = (
    <View style={styles.pending} testID="change-password-pending">
      <ActivityIndicator color={theme.colors.primary} />
      <SansSerifText size="base" style={{ color: theme.colors.mutedForeground }}>
        Sending a code to {email}…
      </SansSerifText>
    </View>
  );

  return (
    <BottomSheet open={flow.open} onOpenChange={flow.setOpen} snapPoints={["70%", "95%"]}>
      <BottomSheet.Content>
        <BottomSheet.Header>
          <SansSerifBoldText size="lg">Change password</SansSerifBoldText>
        </BottomSheet.Header>
        <BottomSheet.Body>
          {flow.phase === "sending" ? (
            pending
          ) : (
            <Suspense fallback={pending}>
              <ResetPasswordForm
                embedded
                title="Choose a new password"
                description={`Enter the code we sent to ${email}.`}
                onSubmit={flow.submit}
                loading={flow.submitting}
                error={flow.error}
              />
            </Suspense>
          )}
        </BottomSheet.Body>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  pending: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
});
