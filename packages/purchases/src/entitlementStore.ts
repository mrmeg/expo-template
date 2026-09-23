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
}

export interface EntitlementState extends EntitlementSources {
  /** Whether `configure()` succeeded this session. */
  sdkStatus: SdkStatus;
  /** True once the persisted snapshot was read (or no storage is configured). */
  hydrated: boolean;
  /** User the store is scoped to; set by `hydrate`, cleared by `clear`. */
  userId: string | null;

  setSdkStatus: (status: SdkStatus) => void;
  applyCustomerState: (customer: CustomerState | null) => void;
  applyServerEntitlement: (until: number | null) => void;
  /** Scope the store to a user and read that user's snapshot. */
  hydrate: (userId: string | null) => Promise<void>;
  /** Sign-out: drop live state and the persisted snapshot for `userId` (default: the hydrated user). */
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

/**
 * Decide access from the sources, in trust order: dev override (development
 * builds only) → device customer state → server expiry → persisted snapshot
 * (only while neither live source has reported) → none. A non-default
 * `entitlement` is checked against the device's active list only; the server
 * and snapshot know the configured entitlement alone.
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

  const until = maxKnown([customer?.until, serverUntil]);
  if (customer?.isActive) return { isEntitled: true, until, source: "device" };
  if (serverUntil !== null && serverUntil > now) return { isEntitled: true, until, source: "server" };
  if (
    customer === null &&
    serverUntil === null &&
    snapshot?.isActive &&
    (snapshot.until === null || snapshot.until > now)
  ) {
    return { isEntitled: true, until: snapshot.until, source: "snapshot" };
  }
  return { isEntitled: false, until, source: "none" };
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

  const initial = {
    sdkStatus: "idle" as SdkStatus,
    customer: null as CustomerState | null,
    serverUntil: null as number | null,
    snapshot: null as EntitlementSnapshot | null,
    hydrated: false,
    devOverride: false,
    userId: null as string | null,
  };

  return createStore<EntitlementState>((set, get) => {
    /**
     * Persist the live verdict — revocations included, so a later cold start
     * can show the paywall without waiting on the network. Nothing is written
     * while neither live source has reported: the previous snapshot stands.
     */
    const persist = (): void => {
      if (!storage) return;
      const { customer, serverUntil, userId } = get();
      if (customer === null && serverUntil === null) return;
      const live = resolveEntitlement({ customer, serverUntil, snapshot: null, devOverride: false });
      const snapshot: EntitlementSnapshot = {
        version: ENTITLEMENT_SNAPSHOT_VERSION,
        userId,
        savedAt: Date.now(),
        isActive: live.isEntitled,
        until: live.until,
      };
      storage.setItem(keyFor(userId), JSON.stringify(snapshot)).catch(() => {
        // Persistence is best-effort; the live sources are authoritative.
      });
    };

    return {
      ...initial,

      setSdkStatus: (sdkStatus) => set({ sdkStatus }),

      applyCustomerState: (customer) => {
        set({ customer });
        persist();
      },

      applyServerEntitlement: (serverUntil) => {
        set({ serverUntil });
        persist();
      },

      hydrate: async (userId) => {
        set({ userId });
        if (!storage) {
          set({ snapshot: null, hydrated: true });
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
        set({ customer: null, serverUntil: null, snapshot: null, userId: null });
        if (!storage) return;
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
