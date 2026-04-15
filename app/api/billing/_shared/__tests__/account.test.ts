import {
  createStripeBillingAccountResolver,
  type StripeCustomerLike,
  type StripeCustomersPort,
} from "../account";
import { CustomerConflictError } from "../types";
import type { StripeSubscriptionLike } from "@/shared/billing";

const FIXED_NOW = new Date("2026-04-15T12:00:00.000Z");

type Calls = {
  findByAppUserId: jest.Mock;
  findByEmail: jest.Mock;
  updateMetadata: jest.Mock;
  create: jest.Mock;
  listActiveSubscriptions: jest.Mock;
};

function makePort(overrides: Partial<Calls> = {}): StripeCustomersPort & Calls {
  const port: Calls = {
    findByAppUserId: overrides.findByAppUserId ?? jest.fn().mockResolvedValue(null),
    findByEmail: overrides.findByEmail ?? jest.fn().mockResolvedValue([]),
    updateMetadata: overrides.updateMetadata ?? jest.fn().mockResolvedValue(undefined),
    create:
      overrides.create ??
      jest.fn<Promise<StripeCustomerLike>, []>().mockResolvedValue({
        id: "cus_new",
        email: null,
        metadata: { appUserId: "u_1" },
      }),
    listActiveSubscriptions:
      overrides.listActiveSubscriptions ?? jest.fn().mockResolvedValue([]),
  };
  return port as StripeCustomersPort & Calls;
}

const user = { userId: "u_1", email: "u1@example.com" };

describe("createStripeBillingAccountResolver — resolveOrCreateCustomer", () => {
  it("returns the metadata-keyed customer when one exists and does NOT backfill", async () => {
    const port = makePort({
      findByAppUserId: jest.fn().mockResolvedValue({
        id: "cus_existing",
        email: "u1@example.com",
        metadata: { appUserId: "u_1" },
      }),
    });
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    const result = await resolver.resolveOrCreateCustomer(user);

    expect(result).toEqual({ customerId: "cus_existing" });
    expect(port.findByEmail).not.toHaveBeenCalled();
    expect(port.updateMetadata).not.toHaveBeenCalled();
    expect(port.create).not.toHaveBeenCalled();
  });

  it("backfills metadata when exactly one unclaimed customer matches by email", async () => {
    const port = makePort({
      findByEmail: jest.fn().mockResolvedValue([
        { id: "cus_legacy", email: "u1@example.com", metadata: {} },
      ]),
    });
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    const result = await resolver.resolveOrCreateCustomer(user);

    expect(result).toEqual({ customerId: "cus_legacy" });
    expect(port.updateMetadata).toHaveBeenCalledWith("cus_legacy", {
      appUserId: "u_1",
    });
    expect(port.create).not.toHaveBeenCalled();
  });

  it("treats a customer already claimed by this user as an acceptable backfill target", async () => {
    const port = makePort({
      findByEmail: jest.fn().mockResolvedValue([
        { id: "cus_mine", email: "u1@example.com", metadata: { appUserId: "u_1" } },
      ]),
    });
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    const result = await resolver.resolveOrCreateCustomer(user);

    expect(result).toEqual({ customerId: "cus_mine" });
  });

  it("throws CustomerConflictError when multiple unclaimed candidates match by email", async () => {
    const port = makePort({
      findByEmail: jest.fn().mockResolvedValue([
        { id: "cus_a", email: "u1@example.com", metadata: {} },
        { id: "cus_b", email: "u1@example.com", metadata: {} },
      ]),
    });
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    await expect(resolver.resolveOrCreateCustomer(user)).rejects.toBeInstanceOf(
      CustomerConflictError,
    );
    expect(port.updateMetadata).not.toHaveBeenCalled();
    expect(port.create).not.toHaveBeenCalled();
  });

  it("ignores candidates already claimed by a different appUserId rather than conflicting", async () => {
    const port = makePort({
      findByEmail: jest.fn().mockResolvedValue([
        { id: "cus_other", email: "u1@example.com", metadata: { appUserId: "u_other" } },
      ]),
      create: jest
        .fn<Promise<StripeCustomerLike>, []>()
        .mockResolvedValue({ id: "cus_fresh", email: "u1@example.com", metadata: {} }),
    });
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    const result = await resolver.resolveOrCreateCustomer(user);

    expect(result).toEqual({ customerId: "cus_fresh" });
    expect(port.updateMetadata).not.toHaveBeenCalled();
    expect(port.create).toHaveBeenCalledWith({
      email: "u1@example.com",
      metadata: { appUserId: "u_1" },
    });
  });

  it("creates a new customer with appUserId metadata when nothing matches", async () => {
    const port = makePort();
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    const result = await resolver.resolveOrCreateCustomer(user);

    expect(result).toEqual({ customerId: "cus_new" });
    expect(port.create).toHaveBeenCalledWith({
      email: "u1@example.com",
      metadata: { appUserId: "u_1" },
    });
  });

  it("does not attempt an email lookup when the user has no email on file", async () => {
    const port = makePort();
    const resolver = createStripeBillingAccountResolver({ stripe: port });

    await resolver.resolveOrCreateCustomer({ userId: "u_2", email: null });

    expect(port.findByEmail).not.toHaveBeenCalled();
    expect(port.create).toHaveBeenCalledWith({
      email: null,
      metadata: { appUserId: "u_2" },
    });
  });
});

describe("createStripeBillingAccountResolver — getBillingSummary", () => {
  const proCatalog = [
    {
      id: "pro",
      label: "Pro",
      stripePriceIdMonth: "price_pro_month",
      stripePriceIdYear: null,
      features: ["export.csv"],
    },
  ];

  it("returns a free summary without customerId when no Stripe customer exists", async () => {
    const port = makePort();
    const resolver = createStripeBillingAccountResolver({
      stripe: port,
      now: () => FIXED_NOW,
    });

    const summary = await resolver.getBillingSummary(user);

    expect(summary.status).toBe("free");
    expect(summary.customerId).toBeNull();
    expect(port.create).not.toHaveBeenCalled();
  });

  it("returns a free summary carrying the customerId when a customer exists but has no active subscription", async () => {
    const port = makePort({
      findByAppUserId: jest.fn().mockResolvedValue({
        id: "cus_existing",
        email: "u1@example.com",
        metadata: { appUserId: "u_1" },
      }),
    });
    const resolver = createStripeBillingAccountResolver({
      stripe: port,
      now: () => FIXED_NOW,
    });

    const summary = await resolver.getBillingSummary(user);

    expect(summary.status).toBe("free");
    expect(summary.customerId).toBe("cus_existing");
  });

  it("normalizes the first active subscription using the injected plan catalog", async () => {
    const subscription: StripeSubscriptionLike = {
      status: "active",
      cancel_at_period_end: false,
      current_period_end: Math.floor(new Date("2026-05-20T00:00:00.000Z").getTime() / 1000),
      items: {
        data: [{ price: { id: "price_pro_month", recurring: { interval: "month" } } }],
      },
      customer: "cus_existing",
    };
    const port = makePort({
      findByAppUserId: jest.fn().mockResolvedValue({
        id: "cus_existing",
        email: "u1@example.com",
        metadata: { appUserId: "u_1" },
      }),
      listActiveSubscriptions: jest.fn().mockResolvedValue([subscription]),
    });
    const resolver = createStripeBillingAccountResolver({
      stripe: port,
      planCatalog: proCatalog,
      now: () => FIXED_NOW,
    });

    const summary = await resolver.getBillingSummary(user);

    expect(summary).toMatchObject({
      customerId: "cus_existing",
      planId: "pro",
      planLabel: "Pro",
      status: "active",
      interval: "month",
      features: ["export.csv"],
    });
  });
});
