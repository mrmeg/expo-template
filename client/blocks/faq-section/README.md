# FAQ section block

Centered heading above a single-open accordion of question/answer pairs.

## Files

- `Block.tsx` — the reusable, props-driven component (`FaqSectionBlock`). Copy this into your app.
- `meta.ts` — registry metadata (label, category, recipe) that drives the blocks gallery.

## Use it

```tsx
import { FaqSectionBlock } from "@/client/blocks/faq-section/Block";

<FaqSectionBlock
  eyebrow="FAQ"
  title="Common questions"
  items={[
    { question: "Is there a free plan?", answer: "Yes — the free plan covers up to 3 projects." },
  ]}
/>
```

`items` defaults to a three-question sample set so `<FaqSectionBlock />` previews without configuration.

Extracted from `client/templates/faq`'s body, minus the screen concerns: no `flex: 1`, no `ScrollView`, and no "still need help" footer — the host screen owns scrolling.
