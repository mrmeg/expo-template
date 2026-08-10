# Hero block

Marketing hero section: eyebrow, headline, copy, and paired CTAs, centered.

## Files

- `Block.tsx` — the reusable, props-driven component (`HeroBlock`). Copy this into your app.
- `meta.ts` — registry metadata (label, category, recipe) that drives the blocks gallery.

## Use it

```tsx
import { HeroBlock } from "@/client/blocks/hero/Block";

<HeroBlock
  eyebrow="Launch week"
  title="Ship your next screen in an afternoon"
  description="Eyebrow, headline, supporting copy, and paired actions."
  primaryAction={{ label: "Get started", onPress: () => {} }}
  secondaryAction={{ label: "See the docs", onPress: () => {} }}
/>
```

Every prop has a default, so `<HeroBlock />` previews without configuration. Pass `primaryAction={null}` / `secondaryAction={null}` to drop a button.

Extracted from `client/templates/hero`'s `centered` variant, minus the screen-level concerns: no `flex: 1` and no safe-area insets, because a block sizes to its content and the host screen owns scrolling and edge insets.
