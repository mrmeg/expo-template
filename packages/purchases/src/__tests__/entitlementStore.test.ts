/**
 * Entitlement store: the merge of on-device customer state, the server's
 * `until`, and the persisted snapshot. Lifted from Mindmap `proStore.ts`
 * (selectors, dev override) and NeuroSpicy `entitlementSnapshot.ts` (user- and
 * version-scoped persistence, revocations persisted too).
 */
import { LIFETIME_UNTIL } from "../constants";
import {
  createEntitlementStore,
  ENTITLEMENT_SNAPSHOT_VERSION,
  entitlementSnapshotKey,
  isUsableSnapshot,
  resolveEntitlement,
  type EntitlementSnapshot,
  type EntitlementStorage,
} from "../entitlementStore";
import type { CustomerState } from "../types";

const NOW = 1_800_000_000_000;
const LATER = NOW + 1000;
const EARLIER = NOW - 1000;

const active: CustomerState = {
  isActive: true,
  until: LATER,
  willRenew: true,
  productId: "app_pro_annual",
  managementUrl: null,
  appUserId: "user-1",
  activeEntitlements: ["pro"],
};
const inactive: CustomerState = { ...active, isActive: false, until: null, productId: null, activeEntitlements: [] };

function snapshot(overrides: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return { version: ENTITLEMENT_SNAPSHOT_VERSION, userId: "user-1", savedAt: NOW, isActive: true, until: LATER, ...overrides };
}

function memoryStorage(): EntitlementStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

const base = { customer: null, serverUntil: null, snapshot: null, devOverride: false };

describe("resolveEntitlement", () => {
  it("grants from the on-device customer state first", () => {
    expect(resolveEntitlement({ ...base, customer: active }, NOW)).toEqual({ isEntitled: true, until: LATER, source: "device" });
    expect(resolveEntitlement({ ...base, customer: inactive }, NOW)).toEqual({ isEntitled: false, until: null, source: "none" });
  });

  it("grants from a future server until and not a past one", () => {
    expect(resolveEntitlement({ ...base, serverUntil: LATER }, NOW)).toEqual({ isEntitled: true, until: LATER, source: "server" });
    expect(resolveEntitlement({ ...base, serverUntil: EARLIER }, NOW)).toEqual({ isEntitled: false, until: EARLIER, source: "none" });
    // An inactive device state does not veto a live server grant.
    expect(resolveEntitlement({ ...base, customer: inactive, serverUntil: LATER }, NOW).source).toBe("server");
  });

  it("reports the latest known expiry across sources", () => {
    expect(resolveEntitlement({ ...base, customer: active, serverUntil: LATER + 5 }, NOW).until).toBe(LATER + 5);
    expect(resolveEntitlement({ ...base, customer: { ...active, until: null } }, NOW).until).toBeNull();
  });

  it("falls back to the snapshot only while no live source has reported", () => {
    expect(resolveEntitlement({ ...base, snapshot: snapshot() }, NOW)).toEqual({ isEntitled: true, until: LATER, source: "snapshot" });
    expect(resolveEntitlement({ ...base, snapshot: snapshot({ until: null }) }, NOW).isEntitled).toBe(true);
    expect(resolveEntitlement({ ...base, snapshot: snapshot({ until: EARLIER }) }, NOW).isEntitled).toBe(false);
    expect(resolveEntitlement({ ...base, snapshot: snapshot({ isActive: false }) }, NOW).isEntitled).toBe(false);
    // Once the device reported a state (even inactive) the snapshot no longer grants.
    expect(resolveEntitlement({ ...base, customer: inactive, snapshot: snapshot() }, NOW).isEntitled).toBe(false);
    // A past server term does not lock out a still-usable snapshot while the device can answer...
    expect(resolveEntitlement({ ...base, serverUntil: EARLIER, snapshot: snapshot() }, NOW)).toMatchObject({
      isEntitled: true,
      source: "snapshot",
    });
    // ...but it does once the device has answered with nothing, or can never answer (web).
    expect(
      resolveEntitlement({ ...base, serverUntil: EARLIER, snapshot: snapshot(), deviceReported: true }, NOW).isEntitled,
    ).toBe(false);
    expect(
      resolveEntitlement({ ...base, serverUntil: EARLIER, snapshot: snapshot(), sdkStatus: "unavailable" }, NOW).isEntitled,
    ).toBe(false);
  });

  it("treats a lapsed active snapshot as no evidence and an inactive one as evidence", () => {
    expect(isUsableSnapshot(null, NOW)).toBe(false);
    expect(isUsableSnapshot(snapshot(), NOW)).toBe(true);
    expect(isUsableSnapshot(snapshot({ until: null }), NOW)).toBe(true);
    expect(isUsableSnapshot(snapshot({ until: EARLIER }), NOW)).toBe(false);
    expect(isUsableSnapshot(snapshot({ isActive: false, until: EARLIER }), NOW)).toBe(true);
  });

  it("reports a lifetime entitlement as until null, whatever the server or snapshot say", () => {
    const lifetime: CustomerState = { ...active, until: null };
    expect(resolveEntitlement({ ...base, customer: lifetime, serverUntil: EARLIER }, NOW)).toEqual({
      isEntitled: true,
      until: null,
      source: "device",
    });
    expect(resolveEntitlement({ ...base, serverUntil: LIFETIME_UNTIL }, NOW)).toEqual({
      isEntitled: true,
      until: null,
      source: "server",
    });
    expect(resolveEntitlement({ ...base, snapshot: snapshot({ until: LIFETIME_UNTIL }) }, NOW)).toEqual({
      isEntitled: true,
      until: null,
      source: "snapshot",
    });
  });

  it("honours the dev override only in development builds", () => {
    expect(__DEV__).toBe(true);
    expect(resolveEntitlement({ ...base, devOverride: true }, NOW)).toEqual({ isEntitled: true, until: null, source: "dev" });
  });

  it("checks a non-default entitlement against the device's active list only", () => {
    const multi: CustomerState = { ...active, activeEntitlements: ["pro", "teams"] };
    expect(resolveEntitlement({ ...base, customer: multi, serverUntil: LATER }, NOW, "teams").source).toBe("device");
    expect(resolveEntitlement({ ...base, customer: active, serverUntil: LATER }, NOW, "teams").isEntitled).toBe(false);
    expect(resolveEntitlement({ ...base, snapshot: snapshot() }, NOW, "teams").isEntitled).toBe(false);
  });
});

describe("createEntitlementStore", () => {
  it("starts idle, unhydrated, with no sources", () => {
    const store = createEntitlementStore();
    expect(store.getState()).toMatchObject({
      sdkStatus: "idle",
      customer: null,
      serverUntil: null,
      snapshot: null,
      hydrated: false,
      deviceReported: false,
      devOverride: false,
      userId: null,
    });
  });

  it("rescoping to another user drops every source synchronously and unhydrates until the read completes", async () => {
    const storage = memoryStorage();
    storage.data.set(entitlementSnapshotKey("purchases:snapshot:", "user-2"), JSON.stringify(snapshot({ userId: "user-2", isActive: false })));
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    store.getState().applyCustomerState(active);
    store.getState().applyServerEntitlement(LATER);
    expect(store.getState().deviceReported).toBe(true);

    const pending = store.getState().hydrate("user-2");
    expect(store.getState()).toMatchObject({
      userId: "user-2",
      customer: null,
      serverUntil: null,
      snapshot: null,
      deviceReported: false,
      hydrated: false,
    });
    expect(resolveEntitlement(store.getState(), NOW).isEntitled).toBe(false);
    await pending;
    expect(store.getState()).toMatchObject({ hydrated: true, snapshot: snapshot({ userId: "user-2", isActive: false }) });
    // Nothing from user-1 was written under user-2's key.
    expect(JSON.parse(storage.data.get(entitlementSnapshotKey("purchases:snapshot:", "user-2"))!)).toMatchObject({ isActive: false });
  });

  it("discards a storage read that started before a sign-out, even for the same user", async () => {
    const reads: Array<(value: string | null) => void> = [];
    const storage: EntitlementStorage = {
      getItem: () => new Promise((resolve) => reads.push(resolve)),
      setItem: async () => {},
      removeItem: async () => {},
    };
    const store = createEntitlementStore({ storage });
    const first = store.getState().hydrate("user-1");
    await store.getState().clear();
    const second = store.getState().hydrate("user-1");
    // The pre-sign-out read resolves with the snapshot that clear() deleted.
    reads[0](JSON.stringify(snapshot()));
    await first;
    expect(store.getState()).toMatchObject({ snapshot: null, hydrated: false });
    reads[1](null);
    await second;
    expect(store.getState()).toMatchObject({ snapshot: null, hydrated: true, userId: "user-1" });
  });

  it("marks the device as reported even when the customer state is null", () => {
    const store = createEntitlementStore();
    store.getState().applyCustomerState(null);
    expect(store.getState().deviceReported).toBe(true);
  });

  it("marks the server as reported even when it has no expiry", () => {
    const store = createEntitlementStore();
    expect(store.getState().serverReported).toBe(false);
    store.getState().applyServerEntitlement(null);
    expect(store.getState().serverReported).toBe(true);
  });

  it("does not persist a server-only verdict before the device has answered, unless the SDK is unavailable", async () => {
    const storage = memoryStorage();
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    store.getState().applyServerEntitlement(LATER);
    await Promise.resolve();
    expect(storage.data.size).toBe(0);

    store.getState().setSdkStatus("unavailable");
    await Promise.resolve();
    expect(storage.data.size).toBe(1);
    expect(JSON.parse(storage.data.get(entitlementSnapshotKey("purchases:snapshot:", "user-1"))!)).toMatchObject({
      isActive: true,
      until: LATER,
    });
  });

  it("skips rewriting an unchanged verdict", async () => {
    const storage = memoryStorage();
    const setItem = jest.spyOn(storage, "setItem");
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    store.getState().applyCustomerState(active);
    store.getState().applyCustomerState({ ...active });
    store.getState().applyCustomerState({ ...active });
    await Promise.resolve();
    expect(setItem).toHaveBeenCalledTimes(1);
    store.getState().applyCustomerState(inactive);
    await Promise.resolve();
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it("never persists for the signed-out scope", async () => {
    const storage = memoryStorage();
    const store = createEntitlementStore({ storage });
    store.getState().applyServerEntitlement(LATER);
    store.getState().applyCustomerState(active);
    await Promise.resolve();
    expect(storage.data.size).toBe(0);
  });

  it("hydrates immediately without storage", async () => {
    const store = createEntitlementStore();
    await store.getState().hydrate("user-1");
    expect(store.getState()).toMatchObject({ hydrated: true, snapshot: null, userId: "user-1" });
  });

  it("reads a matching snapshot and rejects wrong user, wrong version, or garbage", async () => {
    const storage = memoryStorage();
    const key = entitlementSnapshotKey("purchases:snapshot:", "user-1");
    storage.data.set(key, JSON.stringify(snapshot()));
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    expect(store.getState().snapshot).toEqual(snapshot());
    expect(store.getState().hydrated).toBe(true);

    storage.data.set(key, JSON.stringify(snapshot({ userId: "user-2" })));
    await store.getState().hydrate("user-1");
    expect(store.getState().snapshot).toBeNull();

    storage.data.set(key, JSON.stringify(snapshot({ version: 99 as 1 })));
    await store.getState().hydrate("user-1");
    expect(store.getState().snapshot).toBeNull();

    storage.data.set(key, "{not json");
    await store.getState().hydrate("user-1");
    expect(store.getState()).toMatchObject({ snapshot: null, hydrated: true });
  });

  it("uses a custom key prefix", async () => {
    const storage = memoryStorage();
    storage.data.set("acme:user-1", JSON.stringify(snapshot()));
    const store = createEntitlementStore({ storage, storageKeyPrefix: "acme:" });
    await store.getState().hydrate("user-1");
    expect(store.getState().snapshot).toEqual(snapshot());
  });

  it("persists a snapshot on every live update, revocations included", async () => {
    const storage = memoryStorage();
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    const key = entitlementSnapshotKey("purchases:snapshot:", "user-1");

    store.getState().applyCustomerState(active);
    await Promise.resolve();
    expect(JSON.parse(storage.data.get(key)!)).toMatchObject({ version: 1, userId: "user-1", isActive: true, until: LATER });

    store.getState().applyCustomerState(inactive);
    await Promise.resolve();
    expect(JSON.parse(storage.data.get(key)!)).toMatchObject({ isActive: false, until: null });

    store.getState().applyServerEntitlement(LATER + 7);
    await Promise.resolve();
    expect(JSON.parse(storage.data.get(key)!)).toMatchObject({ isActive: true, until: LATER + 7 });
  });

  it("does not persist while neither live source has reported", async () => {
    const storage = memoryStorage();
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    store.getState().applyServerEntitlement(null);
    await Promise.resolve();
    expect(storage.data.size).toBe(0);
  });

  it("clears live state and removes the persisted snapshot for the user", async () => {
    const storage = memoryStorage();
    const store = createEntitlementStore({ storage });
    await store.getState().hydrate("user-1");
    store.getState().applyCustomerState(active);
    store.getState().applyServerEntitlement(LATER);
    store.getState().setSdkStatus("ready");
    await Promise.resolve();
    expect(storage.data.size).toBe(1);

    await store.getState().clear();
    expect(storage.data.size).toBe(0);
    expect(store.getState()).toMatchObject({
      customer: null,
      serverUntil: null,
      snapshot: null,
      userId: null,
      deviceReported: false,
      serverReported: false,
      hydrated: true,
      sdkStatus: "ready",
    });
  });

  it("survives storage failures", async () => {
    const failing: EntitlementStorage = {
      getItem: async () => {
        throw new Error("disk");
      },
      setItem: async () => {
        throw new Error("disk");
      },
      removeItem: async () => {
        throw new Error("disk");
      },
    };
    const store = createEntitlementStore({ storage: failing });
    await expect(store.getState().hydrate("user-1")).resolves.toBeUndefined();
    expect(store.getState().hydrated).toBe(true);
    store.getState().applyCustomerState(active);
    await expect(store.getState().clear()).resolves.toBeUndefined();
  });

  it("toggles the dev override in development and resets to the initial state", () => {
    const store = createEntitlementStore();
    store.getState().setDevOverride(true);
    store.getState().setSdkStatus("unavailable");
    expect(store.getState().devOverride).toBe(true);
    store.getState().reset();
    expect(store.getState()).toMatchObject({ devOverride: false, sdkStatus: "idle", hydrated: false });
  });
});
