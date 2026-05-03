import { configureExpoUiI18n, translateText } from "../i18n";

describe("expo-ui i18n adapter", () => {
  afterEach(() => {
    configureExpoUiI18n(null);
  });

  it("uses literal text before tx keys", () => {
    configureExpoUiI18n((key) => `translated:${key}`);

    expect(translateText("common.submit", "Submit")).toBe("Submit");
  });

  it("falls back to the key when no translator is configured", () => {
    expect(translateText("common.submit")).toBe("common.submit");
  });

  it("uses the configured translator with options", () => {
    const translate = jest.fn((key: string, options?: object) => `${key}:${(options as any)?.count}`);

    configureExpoUiI18n(translate);

    expect(translateText("cart.items", undefined, { count: 3 })).toBe("cart.items:3");
    expect(translate).toHaveBeenCalledWith("cart.items", { count: 3 });
  });
});
