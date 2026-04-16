import { readBillingEnv } from "../env";

describe("readBillingEnv", () => {
  it("reports hasStripeSecrets=false when either key is missing", () => {
    expect(readBillingEnv({}).hasStripeSecrets).toBe(false);
    expect(readBillingEnv({ STRIPE_SECRET_KEY: "sk" }).hasStripeSecrets).toBe(false);
    expect(readBillingEnv({ STRIPE_WEBHOOK_SECRET: "whsec" }).hasStripeSecrets).toBe(false);
  });

  it("reports hasStripeSecrets=true when both keys are present", () => {
    const env = readBillingEnv({
      STRIPE_SECRET_KEY: "sk_test",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
    });
    expect(env.hasStripeSecrets).toBe(true);
    expect(env.stripeSecretKey).toBe("sk_test");
    expect(env.stripeWebhookSecret).toBe("whsec_test");
  });

  it("trims whitespace and treats empty strings as missing", () => {
    const env = readBillingEnv({
      STRIPE_SECRET_KEY: "   ",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
    });
    expect(env.hasStripeSecrets).toBe(false);
    expect(env.stripeSecretKey).toBeNull();
  });

  it("preserves the free plan as-is", () => {
    const { catalog } = { catalog: readBillingEnv({}).planCatalog };
    const free = catalog.find((p) => p.id === "free");
    expect(free).toBeDefined();
    expect(free!.stripePriceIdMonth).toBeNull();
    expect(free!.stripePriceIdYear).toBeNull();
  });

  it("reports appUrl when set", () => {
    const env = readBillingEnv({ EXPO_PUBLIC_APP_URL: "https://app.example.com" });
    expect(env.appUrl).toBe("https://app.example.com");
  });

  it("reports a null appUrl when not set", () => {
    expect(readBillingEnv({}).appUrl).toBeNull();
  });
});
