import { Platform } from "react-native";

/**
 * Same as `router.canGoBack()`, but returns `false` on web.
 *
 * This is because the web router does not support well this function.
 * ( https://github.com/expo/expo/discussions/30977 )
 */
export function canGoBack(router: { canGoBack(): boolean }): boolean {
  const hasPreviousEntry = hasPreviousEntryFromSameOrigin();
  if (hasPreviousEntry == null) {
    return router.canGoBack();
  }

  // Both must agree: browser history has a same-origin entry AND
  // the Stack navigator has a screen to go back to. After a refresh,
  // the browser still has history but the navigator has lost its state.
  return hasPreviousEntry && router.canGoBack();
}

function hasPreviousEntryFromSameOrigin(): boolean | undefined {
  const navigation = getWindowNavigation();
  if (!navigation) {
    return;
  }

  const entries = navigation.entries();
  const currentEntry = navigation.currentEntry;

  if (!currentEntry || currentEntry.index === 0) {
    return false;
  }

  const previousEntry = entries[currentEntry.index - 1];

  try {
    const previousURL = new URL(previousEntry.url);
    return previousURL.origin === window.location.origin;
  } catch (e) {
    return false;
  }
}

function getWindowNavigation(): Navigation | undefined {
  return Platform.OS === "web" && "navigation" in window
    ? (window.navigation as Navigation)
    : undefined;
}

interface NavigationHistoryEntry {
  readonly key: string;
  readonly id: string;
  readonly url: string;
  readonly index: number;
  readonly sameDocument: boolean;
  getState(): unknown;
}

interface NavigationCurrentEntryChangeEvent extends Event {
  readonly navigationType: string;
  readonly from?: NavigationHistoryEntry;
}

interface Navigation {
  readonly currentEntry: NavigationHistoryEntry;
  entries(): NavigationHistoryEntry[];
  addEventListener(
    type: "currententrychange",
    listener: (event: NavigationCurrentEntryChangeEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
}
