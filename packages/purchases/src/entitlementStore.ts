/**
 * Entitlement state: one zustand store merging three signals.
 *
 *  - `customer`: the RevenueCat customer state on this device (purchases,
 *    restores, the SDK's listener).
 *  - `serverUntil`: the expiry the app's backend recorded from the RevenueCat
 *    webhook. Either live source grants access, so a webhook that lands before
 *    the SDK refreshes — or a device whose store account differs from the
 *    signed-in one — still resolves the right plan.
 *  - `snapshot`: the last live verdict, persisted per user, used only until a
 *    live source reports this session so cold starts render from disk instead of
 *    holding the splash screen on a network round-trip.
 *
 * `devOverride` is a development-only switch. Lifted from Mindmap
 * `client/features/pro/proStore.ts` (selectors, dev override) and NeuroSpicy
 * `client/services/subscription/entitlementSnapshot.ts` (user- and
 * version-scoped snapshot, revocations persisted too, sign-out deletes it).
 */
import { createStore, type StoreApi } from "zustand/vanilla";

import { LIFETIME_UNTIL } from "./constants";
import type { CustomerState } from "./types";

export const ENTITLEMENT_SNAPSHOT_VERSION = 1;
export const DEFAULT_SNAPSHOT_KEY_PREFIX = "purchases:snapshot:";

/** Bump `ENTITLEMENT_SNAPSHOT_VERSION` when this shape changes so old payloads are ignored, not misread. */
export interface EntitlementSnapshot {
  version: typeof ENTITLEMENT_SNAPSHOT_VERSION;
  userId: string | null;
  savedAt: number;
  isActive: boolean;
  until: number | null;
}

/** AsyncStorage-compatible persistence. Pass `@react-native-async-storage/async-storage` or any wrapper. */
export interface EntitlementStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type SdkStatus = "idle" | "ready" | "unavailable";
export type EntitlementSource = "dev" | "device" | "server" | "snapshot" | "none";

export interface EntitlementResolution {
  isEntitled: boolean;
  /** Latest known expiry in ms since epoch across the sources consulted; null when unknown or lifetime. */
  until: number | null;
  source: EntitlementSource;
}

export interface EntitlementSources {
  customer: CustomerState | null;
  serverUntil: number | null;
  snapshot: EntitlementSnapshot | null;
  devOverride: boolean;
  /** Optional: whether the device has answered; absent means it still may. */
  deviceReported?: boolean;
  /** Optional: an `unavailable` SDK can never answer, so the snapshot yields to the server. */
  sdkStatus?: SdkStatus;
}

export interface EntitlementState extends EntitlementSources {
  /** Whether `configure()` succeeded this session. */
  sdkStatus: SdkStatus;
  /** True once the persisted snapshot for the current scope was read (or no storage is configured). */
  hydrated: boolean;
  /** True once the device reported a customer state (or its absence) for the current scope. */
  deviceReported: boolean;
  /** True once the app applied its server record (a value or null) for the current scope. */
  serverReported: boolean;
  /** User the store is scoped to; set by `hydrate`, cleared by `clear`. */
  userId: string | null;

  setSdkStatus: (status: SdkStatus) => void;
  applyCustomerState: (customer: CustomerState | null) => void;
  applyServerEntitlement: (until: number | null) => void;
  /**
   * Scope the store to a user: drop every source from the previous scope, then
   * read this user's snapshot. `hydrated` is false until the read completes.
   */
  hydrate: (userId: string | null) => Promise<void>;
  /**
   * Sign-out: drop live state and the persisted snapshot for `userId` (default:
   * the hydrated user). The signed-out scope is trivially hydrated.
   */
  clear: (userId?: string | null) => Promise<void>;
  setDevOverride: (enabled: boolean) => void;
  reset: () => void;
}

export type EntitlementStore = StoreApi<EntitlementState>;

export interface EntitlementStoreOptions {
  storage?: EntitlementStorage;
  storageKeyPrefix?: string;
}

const isDev = (): boolean => typeof __DEV__ !== "undefined" && __DEV__;

export function entitlementSnapshotKey(prefix: string, userId: string | null): string {
  return `${prefix}${userId ?? "anonymous"}`;
}

function maxKnown(values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => typeof value === "number");
  return known.length ? Math.max(...known) : null;
}

/** `LIFETIME_UNTIL` (and anything past it) reads as "no expiry" for the UI. */
function displayUntil(until: number | null): number | null {
  return until !== null && until >= LIFETIME_UNTIL ? null : until;
}

/**
 * Decide access from the sources, in trust order: dev override (development
 * builds only) → device customer state → server expiry → persisted snapshot →
 * none. The snapshot is consulted only while the device has given no state, and
 * only when the server has not reported, or reported an expired term while the
 * device can still answer (a lagging backend must not lock a renewed subscriber
 * out for the logIn round-trip; on web, where the device never answers, the
 * server verdict stands). A non-default `entitlement` is checked against the
 * device's active list only; the server and snapshot know the configured
 * entitlement alone.
 */
export function resolveEntitlement(
  sources: EntitlementSources,
  now: number = Date.now(),
  entitlement?: string,
): EntitlementResolution {
  if (sources.devOverride && isDev()) return { isEntitled: true, until: null, source: "dev" };

  const { customer, serverUntil, snapshot } = sources;

  if (entitlement !== undefined) {
    return customer?.activeEntitlements.includes(entitlement)
      ? { isEntitled: true, until: null, source: "device" }
      : { isEntitled: false, until: null, source: "none" };
  }

  if (customer?.isActive) {
    // A device lifetime entitlement (`until: null`) is reported as such, never
    // as some other product's expiry.
    const until = customer.until === null ? null : displayUntil(maxKnown([customer.until, serverUntil]));
    return { isEntitled: true, until, source: "device" };
  }
  const until = displayUntil(maxKnown([customer?.until, serverUntil]));
  if (serverUntil !== null && serverUntil > now) return { isEntitled: true, until, source: "server" };
  const devicePending = !(sources.deviceReported ?? false) && sources.sdkStatus !== "unavailable";
  if (
    customer === null &&
    (serverUntil === null || devicePending) &&
    isUsableSnapshot(snapshot, now) &&
    snapshot.isActive
  ) {
    return { isEntitled: true, until: displayUntil(snapshot.until), source: "snapshot" };
  }
  return { isEntitled: false, until, source: "none" };
}

/**
 * A snapshot is evidence when it still describes the present: an inactive one
 * always is; an active one only until its `until` passes (a renewal may have
 * happened since, so a lapsed snapshot says nothing either way).
 */
export function isUsableSnapshot(
  snapshot: EntitlementSnapshot | null,
  now: number = Date.now(),
): snapshot is EntitlementSnapshot {
  if (!snapshot) return false;
  return !snapshot.isActive || snapshot.until === null || snapshot.until > now;
}

function parseSnapshot(raw: string | null, userId: string | null): EntitlementSnapshot | null {
  if (!raw) return null;
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!candidate || typeof candidate !== "object") return null;
  const snapshot = candidate as Partial<EntitlementSnapshot>;
  if (snapshot.version !== ENTITLEMENT_SNAPSHOT_VERSION) return null;
  if ((snapshot.userId ?? null) !== userId) return null;
  if (typeof snapshot.isActive !== "boolean") return null;
  if (snapshot.until !== null && typeof snapshot.until !== "number") return null;
  return {
    version: ENTITLEMENT_SNAPSHOT_VERSION,
    userId,
    savedAt: typeof snapshot.savedAt === "number" ? snapshot.savedAt : 0,
    isActive: snapshot.isActive,
    until: snapshot.until ?? null,
  };
}

export function createEntitlementStore(options: EntitlementStoreOptions = {}): EntitlementStore {
  const { storage, storageKeyPrefix = DEFAULT_SNAPSHOT_KEY_PREFIX } = options;
  const keyFor = (userId: string | null) => entitlementSnapshotKey(storageKeyPrefix, userId);

  /** Everything scoped to a user; reset whenever the scope changes. */
  const emptyScope = {
    customer: null as CustomerState | null,
    serverUntil: null as number | null,
    snapshot: null as EntitlementSnapshot | null,
    deviceReported: false,
    serverReported: false,
  };

  const initial = {
    ...emptyScope,
    sdkStatus: "idle" as SdkStatus,
    hydrated: false,
    devOverride: false,
    userId: null as string | null,
  };

  /** Last snapshot written per key, so an unchanged verdict is not rewritten on every SDK tick. */
  const lastWritten = new Map<string, string>();

  return createStore<EntitlementState>((set, get) => {
    /**
     * Persist the live verdict — revocations included, so a later cold start
     * can show the paywall without waiting on the network. Nothing is written
     * for the signed-out scope, while neither live source has reported, or
     * before the device has answered on a platform where it can: a server value
     * the app still holds from a previous user must not be written under the
     * new user's key before the SDK has spoken for them.
     */
    const persist = (): void => {
      if (!storage) return;
      const { customer, serverUntil, userId, deviceReported, sdkStatus } = get();
      if (userId === null) return;
      if (customer === null && serverUntil === null) return;
      if (!deviceReported && sdkStatus !== "unavailable") return;
      const live = resolveEntitlement({ customer, serverUntil, snapshot: null, devOverride: false });
      const key = keyFor(userId);
      const verdict = JSON.stringify({ isActive: live.isEntitled, until: live.until });
      if (lastWritten.get(key) === verdict) return;
      lastWritten.set(key, verdict);
      const snapshot: EntitlementSnapshot = {
        version: ENTITLEMENT_SNAPSHOT_VERSION,
        userId,
        savedAt: Date.now(),
        isActive: live.isEntitled,
        until: live.until,
      };
      storage.setItem(key, JSON.stringify(snapshot)).catch(() => {
        lastWritten.delete(key);
      });
    };

    return {
      ...initial,

      setSdkStatus: (sdkStatus) => {
        set({ sdkStatus });
        // "unavailable" unblocks persistence of a server-only verdict (web, key-less build).
        if (sdkStatus === "unavailable") persist();
      },

      applyCustomerState: (customer) => {
        set({ customer, deviceReported: true });
        persist();
      },

      applyServerEntitlement: (serverUntil) => {
        set({ serverUntil, serverReported: true });
        persist();
      },

      hydrate: async (userId) => {
        // Rescope first, synchronously, so the previous user's state can never
        // grant (or be persisted under) the new user's id.
        set({ ...emptyScope, userId, hydrated: false });
        if (!storage) {
          set({ hydrated: true });
          return;
        }
        let snapshot: EntitlementSnapshot | null;
        try {
          snapshot = parseSnapshot(await storage.getItem(keyFor(userId)), userId);
        } catch {
          snapshot = null;
        }
        // A later hydrate for another user wins.
        if (get().userId !== userId) return;
        set({ snapshot, hydrated: true });
      },

      clear: async (userId) => {
        const target = userId === undefined ? get().userId : userId;
        set({ ...emptyScope, userId: null, hydrated: true });
        if (!storage) return;
        lastWritten.delete(keyFor(target));
        try {
          await storage.removeItem(keyFor(target));
        } catch {
          // Best-effort; a stale snapshot is rejected on the next hydrate by user id.
        }
      },

      setDevOverride: (devOverride) => {
        if (!isDev()) return;
        set({ devOverride });
      },

      reset: () => set({ ...initial }),
    };
  });
}
