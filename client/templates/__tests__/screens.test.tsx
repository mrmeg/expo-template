/**
 * Reusable screen template smoke tests.
 *
 * Per the spec: "Test that screen templates render with representative
 * props/defaults and do not crash". Asserts the user-visible strings
 * land in the rendered tree — keeps the tests resilient to layout
 * refactors while still catching the common regression (a refactor
 * stops rendering the title or the action button).
 */

import "@/test/mockTheme";

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { CardGridScreen } from "../card-grid/Screen";
import { ErrorScreen } from "../error/Screen";
import { FaqScreen } from "../faq/Screen";
import { NotificationListScreen } from "../notifications/Screen";
import { PricingScreen } from "../pricing/Screen";
import { SearchResultsScreen } from "../search/Screen";
import { HeroScreen } from "../hero/Screen";
import { ListScreen } from "../list/Screen";
import { SettingsScreen } from "../settings/Screen";
import { StatsScreen } from "../stats/Screen";
import { TestimonialsScreen } from "../testimonials/Screen";
import { WelcomeScreen } from "../welcome/Screen";

describe("WelcomeScreen", () => {
  it("renders title, subtitle, primary action, and footer", async () => {
    const onPrimary = jest.fn();
    await render(
      <WelcomeScreen
        title="Welcome"
        subtitle="Get started"
        primaryAction={{ label: "Sign in", onPress: onPrimary }}
        footerText="By continuing you accept the terms."
      />,
    );

    expect(screen.getByText("Welcome")).toBeTruthy();
    expect(screen.getByText("Get started")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByText("By continuing you accept the terms.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Sign in"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorScreen", () => {
  it("renders the variant defaults when no overrides are supplied", async () => {
    await render(<ErrorScreen variant="not-found" />);
    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(
      screen.getByText("The page you're looking for doesn't exist or has been moved."),
    ).toBeTruthy();
  });

  it("prefers explicit title/description overrides", async () => {
    await render(
      <ErrorScreen
        variant="generic"
        title="Custom title"
        description="Custom description"
      />,
    );
    expect(screen.getByText("Custom title")).toBeTruthy();
    expect(screen.getByText("Custom description")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("invokes the primary action onPress", async () => {
    const onPrimary = jest.fn();
    await render(
      <ErrorScreen
        variant="generic"
        primaryAction={{ label: "Retry", onPress: onPrimary }}
      />,
    );
    await fireEvent.press(screen.getByText("Retry"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("ListScreen", () => {
  it("renders provided items via renderItem", async () => {
    const data = [
      { id: "1", label: "Alpha" },
      { id: "2", label: "Bravo" },
    ];
    await render(
      <ListScreen
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={(item) => (
          <View>
            <Text>{item.label}</Text>
          </View>
        )}
      />,
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
  });

  it("shows the empty state title and description when data is empty", async () => {
    await render(
      <ListScreen
        data={[]}
        keyExtractor={() => ""}
        renderItem={() => null}
        emptyTitle="Nothing yet"
        emptyDescription="Add the first one"
      />,
    );
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByText("Add the first one")).toBeTruthy();
  });

  it("shows skeletons during the loading state instead of the empty UI", async () => {
    await render(
      <ListScreen
        data={[]}
        keyExtractor={() => ""}
        renderItem={() => null}
        loading
        skeletonCount={2}
        emptyTitle="Nothing yet"
      />,
    );
    expect(screen.queryByText("Nothing yet")).toBeNull();
  });

  it("pads the list content, not the list, for the home indicator", async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
        <ListScreen
          data={[{ id: "1", title: "One" }]}
          keyExtractor={(item) => item.id}
          renderItem={(item) => <Text>{item.title}</Text>}
        />
      </SafeAreaInsetsContext.Provider>,
    );

    const list = screen.getByTestId("list-screen-list");
    const content = StyleSheet.flatten(list.props.contentContainerStyle) as Record<string, number>;
    expect(content.paddingBottom).toBeGreaterThanOrEqual(34);
    const outer = StyleSheet.flatten(screen.getByTestId("list-screen").props.style) as Record<string, unknown>;
    expect(outer.paddingBottom).toBeUndefined();
  });
});

describe("HeroScreen", () => {
  it("renders eyebrow, title, description, and both CTAs (centered layout)", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await render(
      <HeroScreen
        layout="centered"
        eyebrow="New"
        title="Ship your app faster"
        description="A production-ready Expo template."
        primaryAction={{ label: "Get Started", onPress: onPrimary }}
        secondaryAction={{ label: "Learn More", onPress: onSecondary }}
      />,
    );

    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Ship your app faster")).toBeTruthy();
    expect(screen.getByText("A production-ready Expo template.")).toBeTruthy();
    expect(screen.getByText("Get Started")).toBeTruthy();
    expect(screen.getByText("Learn More")).toBeTruthy();

    await fireEvent.press(screen.getByText("Get Started"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("renders the full-bleed layout with an image and CTA", async () => {
    const onPrimary = jest.fn();
    await render(
      <HeroScreen
        layout="fullBleed"
        title="Built for teams that ship"
        image="https://example.com/hero.png"
        primaryAction={{ label: "Start free", onPress: onPrimary }}
      />,
    );

    expect(screen.getByText("Built for teams that ship")).toBeTruthy();
    await fireEvent.press(screen.getByText("Start free"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("StatsScreen", () => {
  it("renders the section header, stat cards, and footer note", async () => {
    await render(
      <StatsScreen
        eyebrow="By the numbers"
        title="Trusted at scale"
        description="A snapshot of platform health."
        stats={[
          { label: "Revenue", value: "48.2", unit: "k", change: { value: "+12.5%", direction: "up" } },
          { label: "Churn", value: "2.3", unit: "%", change: { value: "-0.4%", direction: "down" } },
        ]}
        footerNote="Updated daily."
      />,
    );

    expect(screen.getByText("Trusted at scale")).toBeTruthy();
    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("48.2")).toBeTruthy();
    expect(screen.getByText("Churn")).toBeTruthy();
    expect(screen.getByText("+12.5%")).toBeTruthy();
    expect(screen.getByText("-0.4%")).toBeTruthy();
    expect(screen.getByText("Updated daily.")).toBeTruthy();
  });
});

describe("TestimonialsScreen", () => {
  const TESTIMONIALS = [
    { quote: "This cut our setup time from days to hours.", name: "Jamie Lee", role: "CTO, Acme", rating: 5 },
    { quote: "Our team shipped an MVP in two weeks.", name: "Marcus Chen", role: "Founder, Loopwork" },
  ];

  it("renders the section header and each testimonial's quote and author", async () => {
    await render(
      <TestimonialsScreen
        eyebrow="Testimonials"
        title="Loved by teams everywhere"
        testimonials={TESTIMONIALS}
      />,
    );

    expect(screen.getByText("Loved by teams everywhere")).toBeTruthy();
    expect(screen.getByText(/This cut our setup time/)).toBeTruthy();
    expect(screen.getByText("Jamie Lee")).toBeTruthy();
    expect(screen.getByText("CTO, Acme")).toBeTruthy();
    expect(screen.getByText(/Our team shipped an MVP/)).toBeTruthy();
    expect(screen.getByText("Marcus Chen")).toBeTruthy();
  });

  it("pages the quotes through Carousel: one slide and one dot per testimonial", async () => {
    await render(
      <TestimonialsScreen title="Loved by teams everywhere" testimonials={TESTIMONIALS} />,
    );

    expect(screen.getByTestId("testimonials-carousel-item-0")).toBeTruthy();
    expect(screen.getByTestId("testimonials-carousel-item-1")).toBeTruthy();
    expect(screen.queryByTestId("testimonials-carousel-item-2")).toBeNull();
    expect(screen.getByTestId("testimonials-carousel-dot-0")).toBeTruthy();
    expect(screen.getByTestId("testimonials-carousel-dot-1")).toBeTruthy();
  });
});

describe("FaqScreen", () => {
  it("renders questions collapsed and expands an answer on press", async () => {
    await render(
      <FaqScreen
        eyebrow="FAQ"
        title="Frequently asked questions"
        items={[
          { question: "Is there a free plan?", answer: "Yes — the free plan covers up to 3 projects." },
          { question: "Can I cancel anytime?", answer: "Yes, at any time from account settings." },
        ]}
      />,
    );

    expect(screen.getByText("Frequently asked questions")).toBeTruthy();
    expect(screen.getByText("Is there a free plan?")).toBeTruthy();
    expect(screen.getByText("Can I cancel anytime?")).toBeTruthy();
    expect(screen.queryByText("Yes — the free plan covers up to 3 projects.")).toBeNull();

    await fireEvent.press(screen.getByText("Is there a free plan?"));
    expect(screen.getByText("Yes — the free plan covers up to 3 projects.")).toBeTruthy();
  });

  it("renders the still-need-help footer and invokes its action", async () => {
    const onFooterAction = jest.fn();
    await render(
      <FaqScreen
        title="FAQ"
        items={[{ question: "Q1", answer: "A1" }]}
        footerTitle="Still need help?"
        footerActionLabel="Contact support"
        onFooterAction={onFooterAction}
      />,
    );

    expect(screen.getByText("Still need help?")).toBeTruthy();
    await fireEvent.press(screen.getByText("Contact support"));
    expect(onFooterAction).toHaveBeenCalledTimes(1);
  });
});

const ISLAND_INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

describe("SettingsScreen", () => {
  it("adds the home-indicator inset to its bottom padding and leaves the top to the header", async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND_INSETS}>
        <SettingsScreen
          sections={[{ title: "Account", items: [{ type: "navigate", label: "Edit profile", onPress: () => {} }] }]}
        />
      </SafeAreaInsetsContext.Provider>,
    );

    const content = StyleSheet.flatten(screen.getByTestId("settings-screen").props.contentContainerStyle) as Record<string, number>;
    expect(content.paddingBottom).toBeGreaterThanOrEqual(34);
    expect(content.paddingTop).toBeLessThan(59);
  });

  it("takes the top too when told it has no header", async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND_INSETS}>
        <SettingsScreen edges={["top", "bottom"]} sections={[]} />
      </SafeAreaInsetsContext.Provider>,
    );

    const content = StyleSheet.flatten(screen.getByTestId("settings-screen").props.contentContainerStyle) as Record<string, number>;
    expect(content.paddingTop).toBeGreaterThanOrEqual(59);
  });
});

/**
 * Every template owns its safe-area edges through `Screen` (#130 converted
 * settings/list/dashboard/profile; this table covers the rest). Under a Stack
 * header the default is `["bottom"]`: the scrolling surface's content clears
 * the home indicator and nothing pads the top; `["top", "bottom"]` takes the
 * island too. The node under test is the one that carries the inset: a
 * `Screen scroll`'s `contentContainerStyle`, a list's `contentContainerStyle`,
 * or the `Screen` view's `style`.
 */
describe("templates own their safe-area edges", () => {
  const insetCarrier = (testID: string) => {
    const node = screen.getByTestId(testID);
    return StyleSheet.flatten(node.props.contentContainerStyle ?? node.props.style) as Record<string, number>;
  };
  const row = (label: string) => <Text>{label}</Text>;
  const item = { id: "n1", icon: "bell" as const, title: "Welcome", body: "Hi", timestamp: new Date(0), read: false };

  describe.each([
    {
      name: "faq",
      testID: "faq-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <FaqScreen edges={edges} title="FAQ" items={[{ question: "Q?", answer: "A." }]} />
      ),
    },
    {
      name: "pricing",
      testID: "pricing-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <PricingScreen edges={edges} plans={[{ name: "Free", price: "$0", features: [], onSelect: () => {} }]} />
      ),
    },
    {
      name: "stats",
      testID: "stats-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <StatsScreen edges={edges} title="Numbers" stats={[{ label: "Revenue", value: "1" }]} />
      ),
    },
    {
      name: "testimonials",
      testID: "testimonials-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <TestimonialsScreen edges={edges} title="Loved" testimonials={[{ quote: "Great", name: "Ada", role: "CTO" }]} />
      ),
    },
    {
      name: "card grid",
      testID: "card-grid-list",
      topTestID: "card-grid-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <CardGridScreen edges={edges} data={["a"]} renderCard={row} keyExtractor={(x) => x} />
      ),
    },
    {
      name: "search",
      testID: "search-list",
      topTestID: "search-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <SearchResultsScreen edges={edges} data={["a"]} renderItem={row} keyExtractor={(x) => x} />
      ),
    },
    {
      name: "notifications",
      testID: "notifications-list",
      topTestID: "notifications-screen",
      render: (edges?: ("top" | "bottom")[]) => (
        <NotificationListScreen edges={edges} notifications={[item]} />
      ),
    },
  ])("$name", ({ testID, topTestID = testID, render: renderScreen }: { name: string; testID: string; topTestID?: string; render: (edges?: ("top" | "bottom")[]) => React.ReactElement }) => {
    it("puts the bottom inset on its content and leaves the top to the header by default", async () => {
      await render(
        <SafeAreaInsetsContext.Provider value={ISLAND_INSETS}>{renderScreen()}</SafeAreaInsetsContext.Provider>,
      );
      const style = insetCarrier(testID);
      expect(style.paddingBottom).toBeGreaterThanOrEqual(ISLAND_INSETS.bottom);
      expect(style.paddingTop ?? 0).toBeLessThan(ISLAND_INSETS.top);
    });

    it("takes the top too when told it has no header", async () => {
      await render(
        <SafeAreaInsetsContext.Provider value={ISLAND_INSETS}>{renderScreen(["top", "bottom"])}</SafeAreaInsetsContext.Provider>,
      );
      // A list screen keeps the top inset on the Screen view; its list carries only the bottom.
      expect(insetCarrier(topTestID).paddingTop).toBeGreaterThanOrEqual(ISLAND_INSETS.top);
    });
  });
});
