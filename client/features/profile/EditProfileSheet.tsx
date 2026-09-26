import { useState } from "react";
import { BottomSheet } from "@mrmeg/expo-ui/components/BottomSheet";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { hapticSuccess } from "@mrmeg/expo-ui/lib";
import { notify } from "@mrmeg/expo-ui/state";
import { useProfileStore } from "./profileStore";

export interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether an auth provider is configured; decides the helper copy. */
  authEnabled: boolean;
  /** What the header shows when the display name is empty. */
  fallbackName: string;
}

/**
 * The display name, edited in a sheet and saved to the profile store. It is
 * local to the device: the template ships no profile API, and the copy says so
 * when auth is off, so a fork knows what it is inheriting.
 */
export function EditProfileSheet({ open, onOpenChange, authEnabled, fallbackName }: EditProfileSheetProps) {
  const displayName = useProfileStore((s) => s.displayName);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  // `null` means "not edited yet": the field shows the saved name until typed
  // into, and closing drops the draft, so no effect has to reset it.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? displayName;

  const close = (next: boolean) => {
    if (!next) setDraft(null);
    onOpenChange(next);
  };

  const save = () => {
    setDisplayName(value.trim());
    hapticSuccess();
    notify({ type: "success", messages: ["Profile updated"], duration: 2000 });
    close(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={close}>
      <BottomSheet.Content>
        <BottomSheet.Header>
          <SansSerifBoldText size="lg">Edit profile</SansSerifBoldText>
        </BottomSheet.Header>
        <BottomSheet.Body>
          <TextInput
            testID="edit-profile-name"
            label="Display name"
            value={value}
            onChangeText={setDraft}
            placeholder={fallbackName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
            helperText={
              authEnabled
                ? "Shown at the top of your profile on this device."
                : "Auth is off in this environment, so the name is saved on this device only."
            }
          />
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button testID="edit-profile-save" text="Save" onPress={save} />
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet>
  );
}
