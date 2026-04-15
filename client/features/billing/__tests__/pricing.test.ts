import {
  defaultActionLabel,
  derivePlanActionState,
  derivePricingPlan,
} from "../lib/pricing";
import { freeBillingSummary } from "@/shared/billing";
import type { BillingSummary, PlanDefinition } from "@/shared/billing";

const freePlan: PlanDefinition = {
  id: "free",
  label: "Free",
  stripePriceIdMonth: null,
  stripePriceIdYear: null,
  features: ["Basic analytics"],
};

const proPlan: PlanDefinition = {
  id: "pro",
  label: "Pro",
  stripePriceIdMonth: "price_pro_month",
  stripePriceIdYear: "price_pro_year",
  features: ["Unlimited projects", "Priority support"],
};

function activeSummary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    customerId: "cus_123",
    planId: "pro",
    planLabel: "Pro",
    status: "active",
    interval: "month",
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    features: ["Unlimited projects"],
    sourceUpdatedAt: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("derivePlanActionState", () => {
  it("returns upgrade when the user has no summary yet", () => {
    expect(derivePlanActionState({ planId: "pro", summary: undefined })).toBe(
      "upgrade",
    );
  });

  it("returns upgrade when the user is on free and the plan is paid", () => {
    expect(
      derivePlanActionState({ planId: "pro", summary: freeBillingSummary() }),
    ).toBe("upgrade");
  });

  it("returns current when the plan id matches the summary plan id and status isn't free", () => {
    expect(
      derivePlanActionState({ planId: "pro", summary: activeSummary() }),
    ).toBe("current");
  });

  it("returns manage for non-current paid plans when the user is already entitled", () => {
    expect(
      derivePlanActionState({ planId: "enterprise", summary: activeSummary() }),
    ).toBe("manage");
  });

  it("returns downgrade-disabled for the free plan when the user is paid+entitled", () => {
    expect(
      derivePlanActionState({
        planId: "free",
        summary: activeSummary({ planId: "pro", status: "active" }),
      }),
    ).toBe("downgrade-disabled");
  });

  it("treats past_due as entitled — so the free plan CTA routes through manage", () => {
    expect(
      derivePlanActionState({
        planId: "free",
        summary: activeSummary({ status: "past_due" }),
      }),
    ).toBe("downgrade-disabled");
  });

  it("returns upgrade for the free plan when the summary is already free", () => {
    expect(
      derivePlanActionState({ planId: "free", summary: freeBillingSummary() }),
    ).toBe("upgrade");
  });
});

describe("defaultActionLabel", () => {
  it("hides billing actions behind a sign-in prompt when the user is unauthenticated", () => {
    expect(defaultActionLabel("upgrade", { isAuthenticated: false })).toBe(
      "Sign in to continue",
    );
    expect(defaultActionLabel("manage", { isAuthenticated: false })).toBe(
      "Sign in to continue",
    );
  });

  it("keeps the current-plan label for unauthenticated viewers so the card doesn't lie about their state", () => {
    expect(defaultActionLabel("current", { isAuthenticated: false })).toBe(
      "Current plan",
    );
  });

  it("uses semantic copy for each action state when the user is authenticated", () => {
    expect(defaultActionLabel("upgrade", { isAuthenticated: true })).toBe(
      "Choose plan",
    );
    expect(defaultActionLabel("manage", { isAuthenticated: true })).toBe(
      "Manage subscription",
    );
    expect(
      defaultActionLabel("downgrade-disabled", { isAuthenticated: true }),
    ).toBe("Manage subscription");
    expect(defaultActionLabel("current", { isAuthenticated: true })).toBe(
      "Current plan",
    );
  });
});

describe("derivePricingPlan", () => {
  it("builds a current-plan card when the summary matches", () => {
    const derived = derivePricingPlan({
      plan: proPlan,
      summary: activeSummary(),
      interval: "month",
      display: { price: "$19", highlighted: true, badge: "Popular" },
      isAuthenticated: true,
      onSelect: jest.fn(),
    });

    expect(derived).toMatchObject({
      planId: "pro",
      price: "$19",
      period: "month",
      highlighted: true,
      badge: "Popular",
      isCurrent: true,
      actionState: "current",
      actionLabel: "Current plan",
      loading: false,
    });
    expect(derived.features).toEqual([
      { label: "Unlimited projects", included: true },
      { label: "Priority support", included: true },
    ]);
  });

  it("surfaces an env-level disabled reason ahead of the downgrade one", () => {
    const derived = derivePricingPlan({
      plan: proPlan,
      summary: freeBillingSummary(),
      interval: "month",
      display: { price: "$19" },
      disabledReason: "Billing is not enabled in this environment.",
      isAuthenticated: true,
      onSelect: jest.fn(),
    });

    expect(derived.disabledReason).toBe(
      "Billing is not enabled in this environment.",
    );
  });

  it("adds a downgrade hint when the free plan would be a downgrade for an entitled user", () => {
    const derived = derivePricingPlan({
      plan: freePlan,
      summary: activeSummary(),
      interval: "month",
      display: { price: "$0" },
      isAuthenticated: true,
      onSelect: jest.fn(),
    });

    expect(derived.actionState).toBe("downgrade-disabled");
    expect(derived.disabledReason).toBe("Cancel through Manage subscription.");
    expect(derived.actionLabel).toBe("Manage subscription");
  });

  it("propagates the loading flag so the CTA can render a spinner", () => {
    const derived = derivePricingPlan({
      plan: proPlan,
      summary: freeBillingSummary(),
      interval: "year",
      display: { price: "$15" },
      loading: true,
      isAuthenticated: true,
      onSelect: jest.fn(),
    });

    expect(derived.loading).toBe(true);
  });
});
