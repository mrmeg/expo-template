# FAQ template

Accordion of questions & answers.

## Files

- `Screen.tsx` — the reusable, props-driven component (`FaqScreen`). Copy this into your app.
- `demo.tsx` — a worked example with 6 sample questions; this is what the route renders.
- `meta.ts` — registry metadata that drives the Explore grid.

## Use it

```tsx
import { FaqScreen } from "@/client/templates/faq/Screen";

<FaqScreen
  eyebrow="FAQ"
  title="Frequently asked questions"
  items={[
    { question: "Is there a free plan?", answer: "Yes — the free plan covers up to 3 projects." },
  ]}
  footerTitle="Still need help?"
  footerActionLabel="Contact support"
  onFooterAction={() => {}}
/>
```

Route: `/(main)/(demos)/screen-faq`
