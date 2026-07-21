# Stats template

Metric grid with change indicators.

## Files

- `Screen.tsx` — the reusable, props-driven component (`StatsScreen`). Copy this into your app.
- `demo.tsx` — a worked example with sample metrics; this is what the route renders.
- `meta.ts` — registry metadata that drives the Explore grid.

## Use it

```tsx
import { StatsScreen } from "@/client/templates/stats/Screen";

<StatsScreen
  eyebrow="By the numbers"
  title="Trusted at scale"
  stats={[
    { label: "Revenue", value: "48.2", unit: "k", change: { value: "+12.5%", direction: "up" } },
    { label: "Active Users", value: "9,842", change: { value: "+4.1%", direction: "up" } },
  ]}
/>
```

Route: `/(main)/(demos)/screen-stats`
