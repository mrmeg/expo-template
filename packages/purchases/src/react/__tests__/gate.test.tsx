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
      {`${view.isEntitled}|${view.source}|${view.hydrated}|${view.isReady}|${view.isConfigured}|${view.until ?? "-"}`}
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
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|false|false|-");
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
    expect(screen.getByTestId("probe").props.children).toBe(`true|device|true|true|true|${LATER}`);

    await act(async () => client.emit(inactiveCustomer));
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|true|true|-");
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
    expect(screen.getByTestId("probe").props.children).toBe(`true|server|true|true|true|${LATER}`);

    await rerender(
      <PurchasesProvider client={client} store={store} userId={null} serverUntil={null}>
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.logOut).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ customer: null, serverUntil: null, userId: null });
    expect(screen.getByTestId("probe").props.children).toBe("false|none|true|true|true|-");
  });

  it("logs the new user in when the user id changes", async () => {
    const client = fakeClient();
    const store = createEntitlementStore();
    const { rerender } = await render(
      <PurchasesProvider client={client} store={store} userId="user-1">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    await rerender(
      <PurchasesProvider client={client} store={store} userId="user-2">
        <Probe />
      </PurchasesProvider>,
    );
    await flush();
    expect(client.logIn).toHaveBeenLastCalledWith("user-2");
    expect(store.getState().userId).toBe("user-2");
  });
});

describe("useEntitlement outside a provider", () => {
  it("throws a readable error", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow(/PurchasesProvider/);
    spy.mockRestore();
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
