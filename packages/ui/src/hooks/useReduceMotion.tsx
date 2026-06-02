import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";

let sharedValue = false;
const listeners = new Set<() => void>();
let subscription: { remove: () => void } | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function setSharedValue(next: boolean) {
  if (next === sharedValue) return;
  sharedValue = next;
  notify();
}

function startListening() {
  if (Platform.OS === "web") {
    // On web, use the media query
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setSharedValue(mq.matches);
      const handler = (e: MediaQueryListEvent) => setSharedValue(e.matches);
      mq.addEventListener("change", handler);
      subscription = { remove: () => mq.removeEventListener("change", handler) };
    }
    return;
  }

  AccessibilityInfo.isReduceMotionEnabled().then(setSharedValue);

  subscription = AccessibilityInfo.addEventListener(
    "reduceMotionChanged",
    setSharedValue,
  );
}

function stopListening() {
  subscription?.remove();
  subscription = null;
}

// useSyncExternalStore contract: register the consumer, lazily starting the
// shared OS subscription on the first listener and tearing it down after the
// last unmounts.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    startListening();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening();
    }
  };
}

function getSnapshot(): boolean {
  return sharedValue;
}

// The server can't know the user's accessibility preference; default to
// "motion allowed" so SSR and the first client render agree (the real value
// arrives via subscribe() after hydration).
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Hook that returns whether the user prefers reduced motion.
 *
 * Backed by useSyncExternalStore so the value is read straight from a shared
 * OS subscription — no mount-time setState, no polling, and a clean SSR
 * snapshot that hydrates without a mismatch. A single singleton listener is
 * shared across all consumers.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
