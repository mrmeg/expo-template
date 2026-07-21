# Testimonials template

Snap-scrolling quote cards.

## Files

- `Screen.tsx` — the reusable, props-driven component (`TestimonialsScreen`). Copy this into your app.
- `demo.tsx` — a worked example with 4 sample testimonials; this is what the route renders.
- `meta.ts` — registry metadata that drives the Explore grid.

## Use it

```tsx
import { TestimonialsScreen } from "@/client/templates/testimonials/Screen";

<TestimonialsScreen
  eyebrow="Testimonials"
  title="Loved by teams everywhere"
  testimonials={[
    { quote: "This cut our setup time from days to hours.", name: "Jamie Lee", role: "CTO, Acme", rating: 5 },
  ]}
/>
```

Route: `/(main)/(demos)/screen-testimonials`
