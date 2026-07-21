import React from "react";
import { Alert, Platform } from "react-native";
import { FaqScreen, type FaqItem } from "./Screen";

const ITEMS: FaqItem[] = [
  {
    question: "Is there a free plan?",
    answer: "Yes — the free plan covers up to 3 projects with core features included, no credit card required.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "You can cancel or downgrade your plan at any time from account settings. Changes take effect at the end of your current billing period.",
  },
  {
    question: "Do you offer a discount for annual billing?",
    answer: "Yes — switching to annual billing saves 20% compared to paying monthly, applied automatically at checkout.",
  },
  {
    question: "What platforms are supported?",
    answer: "The app runs on iOS, Android, and web from a single codebase, sharing the same components and business logic.",
  },
  {
    question: "How do I migrate an existing project?",
    answer: "Follow the migration guide in the docs — it walks through a tiered assessment and a recommended order for adopting each piece.",
  },
  {
    question: "Where can I get support?",
    answer: "Use the contact button below, or reach out through the community channels linked in the docs footer.",
  },
];

function showAlert(msg: string) {
  if (Platform.OS === "web") {
    window.alert(msg);
  } else {
    Alert.alert(msg);
  }
}

export default function ScreenFaqDemo() {
  return (
    <FaqScreen
      eyebrow="FAQ"
      title="Frequently asked questions"
      description="Everything you need to know before you get started."
      items={ITEMS}
      footerTitle="Still need help?"
      footerDescription="Our team typically responds within one business day."
      footerActionLabel="Contact support"
      onFooterAction={() => showAlert("Contact support")}
    />
  );
}
