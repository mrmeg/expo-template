import { Platform, type GestureResponderEvent } from "react-native";

export function blurActiveElementOnWeb(event?: GestureResponderEvent) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  const currentTarget = event?.currentTarget as { blur?: () => void } | null | undefined;
  currentTarget?.blur?.();

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}
