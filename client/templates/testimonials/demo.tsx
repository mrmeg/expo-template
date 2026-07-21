import React from "react";
import { TestimonialsScreen, type Testimonial } from "./Screen";

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "This cut our setup time from days to hours. The design system alone saved us weeks of work.",
    name: "Jamie Lee",
    role: "CTO, Acme",
    rating: 5,
  },
  {
    quote: "The best starting point we've used for a React Native project. Everything just works together.",
    name: "Priya Nair",
    role: "Lead Engineer, Northwind",
    rating: 5,
  },
  {
    quote: "Our team shipped an MVP in two weeks instead of two months. Hard to overstate the impact.",
    name: "Marcus Chen",
    role: "Founder, Loopwork",
    rating: 4,
  },
  {
    quote: "Clean architecture, sensible defaults, and it doesn't fight you when you need to customize.",
    name: "Sofia Alvarez",
    role: "Staff Engineer, Brightline",
    rating: 5,
  },
];

export default function ScreenTestimonialsDemo() {
  return (
    <TestimonialsScreen
      eyebrow="Testimonials"
      title="Loved by teams everywhere"
      description="See what teams shipping real products have to say."
      testimonials={TESTIMONIALS}
    />
  );
}
