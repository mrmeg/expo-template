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
import { Text, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ErrorScreen } from "../error/Screen";
import { FaqScreen } from "../faq/Screen";
import { HeroScreen } from "../hero/Screen";
import { ListScreen } from "../list/Screen";
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
  it("renders the section header and each testimonial's quote and author", async () => {
    await render(
      <TestimonialsScreen
        eyebrow="Testimonials"
        title="Loved by teams everywhere"
        testimonials={[
          { quote: "This cut our setup time from days to hours.", name: "Jamie Lee", role: "CTO, Acme", rating: 5 },
          { quote: "Our team shipped an MVP in two weeks.", name: "Marcus Chen", role: "Founder, Loopwork" },
        ]}
      />,
    );

    expect(screen.getByText("Loved by teams everywhere")).toBeTruthy();
    expect(screen.getByText(/This cut our setup time/)).toBeTruthy();
    expect(screen.getByText("Jamie Lee")).toBeTruthy();
    expect(screen.getByText("CTO, Acme")).toBeTruthy();
    expect(screen.getByText(/Our team shipped an MVP/)).toBeTruthy();
    expect(screen.getByText("Marcus Chen")).toBeTruthy();
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
