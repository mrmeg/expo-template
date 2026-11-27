/**
 * React Native tracker: the core plus AppState-driven sessions. Storage comes
 * from the host (AsyncStorage-compatible); without it the anonymous id and the
 * unsent queue last one launch.
 */
import { AppState, Platform as RNPlatform } from "react-native";
import type { AppStateStatus } from "react-native";

import { createTrackerCore } from "../client/tracker";
import type { EventMap, Tracker, TrackerOptions } from "../client/tracker";
import { LIMITS } from "../shared/wire";
import type { Platform } from "../shared/wire";

export type {
  EventMap,
  FlushOptions,
  KeyValueStorage,
  TrackArgs,
  Tracker,
  TrackerOptions,
  Transport,
  TransportRequest,
  TransportResponse,
} from "../client/tracker";

export interface NativeTrackerOptions extends Omit<TrackerOptions, "platform" | "identify"> {
  /** Default from `Platform.OS`. */
  platform?: Platform;
  /** A background gap longer than this ends the session. Default 30 minutes. */
  sessionIdleMs?: number;
}

export type NativeTracker<Events extends EventMap = EventMap> = Tracker<Events> & {
  /** Removes the AppState subscription. */
  destroy(): void;
};

export function createNativeTracker<Events extends EventMap = EventMap>(
  options: NativeTrackerOptions,
): NativeTracker<Events> {
  const now = options.now ?? Date.now;
  const sessionIdleMs = options.sessionIdleMs ?? LIMITS.sessionIdleMs;
  const { tracker: core, internals } = createTrackerCore<Events>({
    ...options,
    platform: options.platform ?? platformFromOS(RNPlatform.OS),
    identify: true,
  });

  // iOS reports "unknown" briefly at launch in some versions; only an explicit
  // background state means the app is not in front of the user.
  let foreground = isForeground(AppState.currentState);
  let backgroundAt: number | undefined;

  const ensureSession = () => {
    if (foreground && !internals.session()) core.startSession();
  };

  const onChange = (state: AppStateStatus) => {
    if (state === "background") {
      if (!foreground) return;
      foreground = false;
      backgroundAt = now();
      void core.flush();
      return;
    }
    // iOS "inactive" (Control Center, the app switcher) is not a departure.
    if (state !== "active" || foreground) return;
    foreground = true;
    const leftAt = backgroundAt;
    backgroundAt = undefined;
    if (leftAt !== undefined && internals.session() && now() - leftAt > sessionIdleMs) {
      // The session really ended when the app left the foreground, not now.
      internals.endSessionAt(leftAt);
    }
    ensureSession();
  };

  const subscription = AppState.addEventListener("change", onChange);
  ensureSession();

  let destroyed = false;
  return {
    ...core,
    setEnabled: (enabled) => {
      core.setEnabled(enabled);
      if (enabled) ensureSession();
    },
    reset: () => {
      // Signing out does not leave the app; the next user's events get a fresh
      // session, opened after the flush so it is not sent with the old user's headers.
      return core.reset().then(ensureSession);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      subscription.remove();
    },
  };
}

function isForeground(state: string | null | undefined): boolean {
  return state !== "background" && state !== "inactive";
}

function platformFromOS(os: string): Platform {
  if (os === "android" || os === "web") return os;
  // iOS, plus macOS and visionOS builds that report Apple platforms.
  return "ios";
}
