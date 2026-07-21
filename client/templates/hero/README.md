# Hero template

Landing hero block: centered & full-bleed layouts.

## Files

- `Screen.tsx` — the reusable, props-driven component (`HeroScreen`). Copy this into your app.
- `demo.tsx` — a worked example showing both layouts stacked; this is what the route renders.
- `meta.ts` — registry metadata that drives the Explore grid.

## Use it

```tsx
import { HeroScreen } from "@/client/templates/hero/Screen";

<HeroScreen
  layout="centered"
  eyebrow="New"
  title="Ship your app faster"
  description="A production-ready Expo template with authentication, theming, and a full component library included."
  primaryAction={{ label: "Get Started", onPress: () => {} }}
  secondaryAction={{ label: "Learn More", onPress: () => {} }}
/>
```

`layout="fullBleed"` renders an `image` (via `expo-image`) edge-to-edge with a flat scrim behind the text for readability — pass an `image` source when using it.

Route: `/(main)/(demos)/screen-hero`
