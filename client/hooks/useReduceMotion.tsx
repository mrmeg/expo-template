import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

let sharedValue = false;
let listenerCount = 0;
let subscription: { remove: () => void } | null = null;

function startListening() {
  if (Platform.OS === "web") {
    // On web, use the media query
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      sharedValue = mq.matches;
      const handler = (e: MediaQueryListEvent) => { sharedValue = e.matches; };
      mq.addEventListener("change", handler);
      subscription = { remove: () => mq.removeEventListener("change", handler) };
    }
    return;
  }

  AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    sharedValue = enabled;
  });

  const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
    sharedValue = enabled;
  });
  subscription = sub;
}

function stopListening() {
  subscription?.remove();
  subscription = null;
}

/**
 * Hook that returns whether the user prefers reduced motion.
 * Uses a shared singleton listener so multiple consumers don't create duplicate subscriptions.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(sharedValue);

  useEffect(() => {
    listenerCount++;
    if (listenerCount === 1) {
      startListening();
    }

    // Re-read current value on mount (may have changed since last render)
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.matchMedia) {
        const current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setReduceMotion(current);
      }
    } else {
      AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    }

    // Poll the shared value to pick up changes (lightweight — only boolean comparison)
    const interval = setInterval(() => {
      setReduceMotion((prev) => (prev !== sharedValue ? sharedValue : prev));
    }, 500);

    return () => {
      clearInterval(interval);
      listenerCount--;
      if (listenerCount === 0) {
        stopListening();
      }
    };
  }, []);

  return reduceMotion;
}
