# CTA banner block

Accent-bordered card with copy on one side and a single action on the other;
stacks to a column on phones.

## Files

- `Block.tsx` — the reusable, props-driven component (`CtaBannerBlock`). Copy this into your app.
- `meta.ts` — registry metadata (label, category, recipe) that drives the blocks gallery.

## Use it

```tsx
import { CtaBannerBlock } from "@/client/blocks/cta-banner/Block";

<CtaBannerBlock
  title="Ready when you are"
  description="Start from a template or compose your own from blocks."
  actionLabel="Create a screen"
  onAction={() => {}}
/>
```

Every prop has a default, so `<CtaBannerBlock />` previews without configuration.

The row/column decision comes from `useDimensions()` (SSR-seeded), not raw `useWindowDimensions()`, so the server render and the client's first render agree — see `docs/ssr-hydration.md` §4.
