/**
 * React layer: `PurchasesProvider` wiring, `useEntitlement`, `PaywallGate`, and
 * `useRequireEntitlement`. The purchases client is a hand-rolled fake so these
 * cover the provider's effects and the gate rules, not the SDK.
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Pressable, Text } from "react-native";

import { createEntitlementStore } from "../../entitlementStore";
import type { CustomerState, PurchasesClient } from "../../types";
import { PaywallGate } from "../PaywallGate";
import { PurchasesProvider } from "../PurchasesProvider";
import { useEntitlement, useRequireEntitlement } from "../hooks";

const LATER = Date.now() + 60_000;

const activeCustomer: CustomerState = {
  isActive: true,
  until: LATER,
  willRenew: true,
  productId: "app_pro_annual",
  managementUrl: null,
  appUserId: "user-1",
  activeEntitlements: ["pro"],
};
const inactiveCustomer: CustomerState = { ...activeCustomer, isActive: false, until: null, productId: null, activeEntitlements: [] };

function fakeClient(overrides: Partial<PurchasesClient> & { configured?: boolean; customer?: CustomerState | null } = {}) {
  const { configured = true, customer = inactiveCustomer, ...rest } = overrides;
  let ready = false;
  const listeners = new Set<(state: CustomerState) => void>();
  const client: PurchasesClient & { emit: (state: CustomerState) => void } = {
    entitlement: "pro",
    isConfigured: jest.fn(() => configured),
    isReady: jest.fn(() => ready),
    configure: jest.fn(async () => {
      ready = configured;
      return ready;
    }),
    logIn: jest.fn(async () => customer),
    logOut: jest.fn(async () => {}),
    getCustomerState: jest.fn(async () => customer),
    restore: jest.fn(async () => ({ kind: "none" as const, customer: inactiveCustomer })),
    presentPaywall: jest.fn(async () => "cancelled" as const),
    presentPaywallIfNeeded: jest.fn(async () => "not_presented" as const),
    setAttributes: jest.fn(async () => {}),
    subscribe: jest.fn((listener: (state: CustomerState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    emit: (state) => listeners.forEach((listener) => listener(state)),
    ...rest,
  };
  return client;
}

function Probe({ entitlement }: { entitlement?: string }) {
  const view = useEntitlement(entitlement);
  return (
    <Text testID="probe">
      {`${view.isEntitled}|${view.source}|${view.hydrated}|${view.isReady}|${view.isConfigured}|${view.until ?? "-"}|${view.settled}`}
    </Text>
  );
}

function RequireButton({ feature }: { feature: string }) {
  const require = useRequireEntitlement(feature);
  const [last, setLast] = React.useState("none");
  return (
    <Pressable testID="require" onPress={() => setLast(String(require()))}>
      <Text testID="require-result">{last}</Text>
    </Pressable>
  );
}

const flush = () => act(async () => {});

describe("PurchasesProvider", () => {
  it("does nothing with the SDK while signed out and marks the store unavailable without a key", async () => {
    const client = fakeClient({ configured: false });
    const store = createEntitlementStore();
    await render(
      <PurchasesProvider client={client} store={store} userId={null}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.configure).not.toHaveBeenCalled();
    expect(store.getState().sdkStatus).toBe("idle");

    await render(
      <PurchasesProvider client={client} store={store} userId="user-1">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.configure).not.toHaveBeenCalled();
    expect(store.getState().sdkStatus).toBe("unavailable");
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|false|false|-|true");
  });

  it("configures for the signed-in user, applies the customer state, and follows listener updates", async () => {
    const client = fakeClient({ customer: activeCustomer });
    const store = createEntitlementStore();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.configure).toHaveBeenCalledWith("user-1");
    expect(client.logIn).toHaveBeenCalledWith("user-1");
    expect(store.getState().sdkStatus).toBe("ready");
    expect(store.getState().userId).toBe("user-1");
    expect(screen.getByTestId("probe").props.children).toBe(`true|device|true|true|true|${LATER}|true`);

    await act(async () => client.emit(inactiveCustomer));
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|true|true|-|true");
  });

  it("mirrors the server until and clears on sign-out", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1" serverUntil={LATER}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe").props.children).toBe(`true|server|true|true|true|${LATER}|true`);

    await rerender(
      <PurchasesProvider client={client} store={store} userId={null} serverUntil={null}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.logOut).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ customer: null, serverUntil: null, userId: null });
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|true|true|-|true");
  });

  it("logs the new user in when the user id changes and drops the previous user's state", async () => {
    let customer: CustomerState | null = activeCustomer;
    const client = fakeClient({ logIn: jest.fn(async () => customer), getCustomerState: jest.fn(async () => customer) });
    const store = createEntitlementStore();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1" serverUntil={LATER}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe").props.children).toBe(`true|device|true|true|true|${LATER}|true`);

    // user-2's logIn fails (null): nothing of user-1 may grant, and the verdict is still settled.
    customer = null;
    await rerender(
      <PurchasesProvider client={client} store={store} userId="user-2" serverUntil={null}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.logIn).toHaveBeenLastCalledWith("user-2");
    expect(store.getState()).toMatchObject({ userId: "user-2", customer: null, serverUntil: null, deviceReported: true });
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|true|true|-|true");
  });

  it("re-applies serverUntil for the new user after a switch", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1" serverUntil={LATER}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    await rerender(
      <PurchasesProvider client={client} store={store} userId="user-2" serverUntil={LATER}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(store.getState()).toMatchObject({ userId: "user-2", serverUntil: LATER });
  });

  it("holds the server source while serverPending, then applies it", async () => {
    const client = fakeClient({ configured: false });
    const store = createEntitlementStore();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1" serverPending>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(store.getState().serverReported).toBe(false);
    // Unavailable SDK + pending server: nothing has spoken, so not settled.
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|false|false|-|false");

    await rerender(
      <PurchasesProvider client={client} store={store} userId="user-1" serverUntil={LATER}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe").props.children).toBe(`true|server|true|false|false|${LATER}|true`);
  });

  it("does not persist or mirror serverUntil while signed out", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    await render(
      <PurchasesProvider client={client} store={store} userId={null} serverUntil={LATER}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(store.getState().serverUntil).toBeNull();
  });
});

describe("PurchasesProvider identity ordering", () => {
  it("ignores customer updates emitted before logIn resolves (the previous user's anonymous state)", async () => {
    let resolveLogIn!: (state: CustomerState | null) => void;
    const client = fakeClient({
      logIn: jest.fn(() => new Promise<CustomerState | null>((resolve) => (resolveLogIn = resolve))),
    });
    const store = createEntitlementStore();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-2">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    // Nothing is subscribed yet, so an SDK emission cannot be applied under user-2.
    expect(client.subscribe).not.toHaveBeenCalled();
    await act(async () => client.emit(inactiveCustomer));
    expect(store.getState().customer).toBeNull();
    expect(store.getState().deviceReported).toBe(false);

    await act(async () => resolveLogIn(activeCustomer));
    expect(client.subscribe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("probe").props.children).toBe(`true|device|true|true|true|${LATER}|true`);
  });

  it("logs out on a sign-out that lands while configure is still in flight", async () => {
    let resolveConfigure!: (ok: boolean) => void;
    const client = fakeClient({
      configure: jest.fn(() => new Promise<boolean>((resolve) => (resolveConfigure = resolve))),
    });
    const store = createEntitlementStore();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    await rerender(
      <PurchasesProvider client={client} store={store} userId={null}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.logOut).toHaveBeenCalledTimes(1);
    await act(async () => resolveConfigure(true));
    expect(client.logIn).not.toHaveBeenCalled();
  });
});

describe("useEntitlement outside a provider", () => {
  it("throws a readable error", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow(/PurchasesProvider/);
    spy.mockRestore();
  });
});

describe("PaywallGate settling", () => {
  function deferredClient() {
    let resolveLogIn!: (state: CustomerState | null) => void;
    const client = fakeClient({
      logIn: jest.fn(() => new Promise<CustomerState | null>((resolve) => (resolveLogIn = resolve))),
    });
    return { client, resolveLogIn: (state: CustomerState | null) => resolveLogIn(state) };
  }

  it("waits for the device to report before reporting a block, then renders children for a paying user", async () => {
    const { client, resolveLogIn } = deferredClient();
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByText("locked")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();

    await act(async () => resolveLogIn(activeCustomer));
    expect(screen.getByText("secret")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("reports once the device has reported nothing", async () => {
    const { client, resolveLogIn } = deferredClient();
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <PaywallGate feature="export">
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(onBlocked).not.toHaveBeenCalled();
    await act(async () => resolveLogIn(null));
    expect(onBlocked).toHaveBeenCalledWith("export");
  });

  it("reports immediately when the SDK is unavailable, but never for a signed-out visitor", async () => {
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={fakeClient({ configured: false })} store={store} userId="user-1" onBlocked={onBlocked}>
        <PaywallGate feature="export">
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(onBlocked).toHaveBeenCalledTimes(1);

    const anonymousBlocked = jest.fn();
    await render(
      <PurchasesProvider client={fakeClient()} store={createEntitlementStore()} userId={null} onBlocked={anonymousBlocked}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByText("locked")).toBeTruthy();
    expect(anonymousBlocked).not.toHaveBeenCalled();
  });

  it("does not settle a lapsed or inactive snapshot before the device answers, and needs no device when a snapshot grants", async () => {
    const { client, resolveLogIn } = deferredClient();
    const inactiveStorage = {
      getItem: async () => JSON.stringify({ version: 1, userId: "user-1", savedAt: 1, isActive: false, until: null }),
      setItem: async () => {},
      removeItem: async () => {},
    };
    const store = createEntitlementStore({ storage: inactiveStorage });
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(store.getState().snapshot).toMatchObject({ isActive: false });
    expect(onBlocked).not.toHaveBeenCalled();
    await act(async () => resolveLogIn(activeCustomer));
    expect(screen.getByText("secret")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();

    const activeStorage = {
      getItem: async () => JSON.stringify({ version: 1, userId: "user-1", savedAt: 1, isActive: true, until: LATER }),
      setItem: async () => {},
      removeItem: async () => {},
    };
    const { client: pending } = deferredClient();
    await render(
      <PurchasesProvider client={pending} store={createEntitlementStore({ storage: activeStorage })} userId="user-1">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe").props.children).toBe(`true|snapshot|true|true|true|${LATER}|true`);
  });

  it("on web (no key) waits for the server before reporting a block", async () => {
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    const client = fakeClient({ configured: false });
    const tree = (props: { serverPending?: boolean; serverUntil?: number | null }) => (
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked} {...props}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>
    );
    const { rerender } = await render(tree({ serverPending: true }));
    await flush();
    expect(onBlocked).not.toHaveBeenCalled();
    await rerender(tree({ serverUntil: LATER }));
    await flush();
    expect(screen.getByText("secret")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();

    // A server answer of "nothing" settles and blocks.
    const blocked = jest.fn();
    await render(
      <PurchasesProvider client={fakeClient({ configured: false })} store={createEntitlementStore()} userId="user-1" onBlocked={blocked} serverUntil={null}>
        <PaywallGate feature="export">
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(blocked).toHaveBeenCalledWith("export");
  });

  it("does not settle on a lapsed active snapshot or an expired server term while the device is pending", async () => {
    const { client, resolveLogIn } = deferredClient();
    const storage = {
      getItem: async () =>
        JSON.stringify({ version: 1, userId: "user-1", savedAt: 1, isActive: true, until: Date.now() - 1000 }),
      setItem: async () => {},
      removeItem: async () => {},
    };
    const store = createEntitlementStore({ storage });
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked} serverUntil={Date.now() - 1000}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(store.getState().snapshot).not.toBeNull();
    expect(onBlocked).not.toHaveBeenCalled();
    await act(async () => resolveLogIn(activeCustomer));
    expect(screen.getByText("secret")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("reports again for a new user who is also blocked", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    const tree = (userId: string) => (
      <PurchasesProvider client={client} store={store} userId={userId} onBlocked={onBlocked}>
        <PaywallGate feature="export">
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>
    );
    const { rerender } = await render(tree("user-1"));
    await flush();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    await rerender(tree("user-2"));
    await flush();
    expect(onBlocked).toHaveBeenCalledTimes(2);
  });

  it("does not flash the paywall on sign-out followed by a paying sign-in", async () => {
    const { client, resolveLogIn } = deferredClient();
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    const tree = (userId: string | null) => (
      <PurchasesProvider client={client} store={store} userId={userId} onBlocked={onBlocked}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>
    );
    const { rerender } = await render(tree("user-1"));
    await act(async () => resolveLogIn(activeCustomer));
    expect(screen.getByText("secret")).toBeTruthy();

    await rerender(tree(null));
    await flush();
    // Signed out: locked, but sign-out never pushes the paywall.
    expect(screen.getByText("locked")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();

    await rerender(tree("user-1"));
    await flush();
    expect(screen.getByText("locked")).toBeTruthy();
    await act(async () => resolveLogIn(activeCustomer));
    expect(screen.getByText("secret")).toBeTruthy();
    expect(onBlocked).not.toHaveBeenCalled();
  });
});

describe("PaywallGate", () => {
  it("renders children when entitled and the fallback otherwise, firing onBlocked once", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByText("locked")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledWith("export");

    await rerender(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <PaywallGate feature="export" fallback={<Text>locked</Text>}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(onBlocked).toHaveBeenCalledTimes(1);

    await act(async () => store.getState().applyCustomerState(activeCustomer));
    expect(screen.getByText("secret")).toBeTruthy();
    expect(screen.queryByText("locked")).toBeNull();
  });

  it("renders nothing without a fallback and prefers its own onBlocked", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const providerBlocked = jest.fn();
    const gateBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={providerBlocked}>
        <PaywallGate feature="media" onBlocked={gateBlocked}>
          <Text>secret</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.queryByText("secret")).toBeNull();
    expect(gateBlocked).toHaveBeenCalledWith("media");
    expect(providerBlocked).not.toHaveBeenCalled();
  });

  it("gates on a non-default entitlement from the device's active list", async () => {
    const client = fakeClient({ customer: { ...activeCustomer, activeEntitlements: ["pro", "teams"] } });
    const store = createEntitlementStore();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1">
        <PaywallGate entitlement="teams">
          <Text>teams</Text>
        </PaywallGate>
        <PaywallGate entitlement="enterprise" fallback={<Text>no enterprise</Text>}>
          <Text>enterprise</Text>
        </PaywallGate>
      </PurchasesProvider>,
    );
    await flush();
    expect(screen.getByText("teams")).toBeTruthy();
    expect(screen.getByText("no enterprise")).toBeTruthy();
  });
});

describe("useRequireEntitlement", () => {
  it("returns false without reporting while the verdict is not settled", async () => {
    let resolveLogIn!: (state: CustomerState | null) => void;
    const client = fakeClient({
      logIn: jest.fn(() => new Promise<CustomerState | null>((resolve) => (resolveLogIn = resolve))),
    });
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <RequireButton feature="export" />
      </PurchasesProvider>,
    );
    await flush();
    await fireEvent.press(screen.getByTestId("require"));
    expect(screen.getByTestId("require-result").props.children).toBe("false");
    expect(onBlocked).not.toHaveBeenCalled();

    await act(async () => resolveLogIn(activeCustomer));
    await fireEvent.press(screen.getByTestId("require"));
    expect(screen.getByTestId("require-result").props.children).toBe("true");
  });

  it("returns true when entitled, otherwise false and calls the provider's onBlocked with the feature", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const onBlocked = jest.fn();
    await render(
      <PurchasesProvider client={client} store={store} userId="user-1" onBlocked={onBlocked}>
        <RequireButton feature="export" />
      </PurchasesProvider>,
    );
    await flush();
    await fireEvent.press(screen.getByTestId("require"));
    expect(screen.getByTestId("require-result").props.children).toBe("false");
    expect(onBlocked).toHaveBeenCalledWith("export");

    await act(async () => store.getState().applyServerEntitlement(LATER));
    await fireEvent.press(screen.getByTestId("require"));
    expect(screen.getByTestId("require-result").props.children).toBe("true");
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });
});
