/**
 * The `(tabs)` stack screen is the only header above the native tab bar, so its
 * title has to follow the focused tab; a fixed "Explore" labelled every tab.
 */
import { tabTitleFromRoute } from "../tabTitle";

describe("tabTitleFromRoute", () => {
  it("names the focused tab from the nested navigator state", () => {
    const routes = [{ name: "index" }, { name: "media" }, { name: "profile" }, { name: "settings" }];
    expect(tabTitleFromRoute({ state: { index: 0, routes } })).toBe("Explore");
    expect(tabTitleFromRoute({ state: { index: 1, routes } })).toBe("Media");
    expect(tabTitleFromRoute({ state: { index: 2, routes } })).toBe("Profile");
    expect(tabTitleFromRoute({ state: { index: 3, routes } })).toBe("Settings");
  });

  it("falls back to params.screen before the tab navigator has state", () => {
    expect(tabTitleFromRoute({ params: { screen: "settings" } })).toBe("Settings");
  });

  it("defaults to Explore with no state, no params, or an unknown tab", () => {
    expect(tabTitleFromRoute(undefined)).toBe("Explore");
    expect(tabTitleFromRoute({})).toBe("Explore");
    expect(tabTitleFromRoute({ state: { index: 0, routes: [{ name: "nope" }] } })).toBe("Explore");
    expect(tabTitleFromRoute({ state: { routes: [{ name: "media" }] } })).toBe("Media");
  });
});
