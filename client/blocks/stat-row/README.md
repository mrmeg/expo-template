# Stat row block

A row of flat stats with change indicators and an optional heading: each
metric is an eyebrow label, a tabular value, and an optional change line under
a hairline rule, not a card.

## Files

- `Block.tsx` — the reusable, props-driven component (`StatRowBlock`). Copy this into your app.
- `meta.ts` — registry metadata (label, category, recipe) that drives the blocks gallery.

## Use it

```tsx
import { StatRowBlock } from "@/client/blocks/stat-row/Block";

<StatRowBlock
  title="This month"
  stats={[
    { label: "Revenue", value: "48.2", unit: "k", change: { value: "+12.4%", direction: "up" } },
    { label: "Churn", value: "1.9", unit: "%", change: { value: "-0.3%", direction: "down" } },
  ]}
/>
```

`stats` defaults to a four-metric sample set. Pass `title={undefined}` to render the row with no heading.

`StatRowMetric` is the same shape `client/templates/stats` and `client/templates/dashboard` use, so a screen can hand the identical array to either tier.
