import React from "react";
import { FlatList } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { OnboardingFlow, type OnboardingPage } from "../OnboardingFlow";

const pages: OnboardingPage[] = [
  { id: "welcome", icon: "compass", title: "Welcome", description: "Start here" },
  { id: "explore", icon: "compass", title: "Explore", description: "See what is available" },
  { id: "finish", icon: "check", title: "Finish", description: "You are ready" },
];

describe("OnboardingFlow", () => {
  it("moves to a pressed step indicator", async () => {
    const scrollToIndex = jest.spyOn(FlatList.prototype, "scrollToIndex");

    await render(<OnboardingFlow pages={pages} onComplete={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText("Go to step 3 of 3: Finish"));

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 2, animated: true });
  });

  it("exposes the current step to assistive technology", async () => {
    await render(<OnboardingFlow pages={pages} onComplete={jest.fn()} />);

    expect(screen.getByLabelText("Go to step 1 of 3: Welcome")).toHaveProp("accessibilityState", {
      selected: true,
    });
    expect(screen.getByLabelText("Go to step 2 of 3: Explore")).toHaveProp("accessibilityState", {
      selected: false,
    });
  });
});
