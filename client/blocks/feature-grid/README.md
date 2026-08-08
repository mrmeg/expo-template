# Feature grid block

Icon + title + copy cards in a responsive grid: 1 column on phones, 2 on
mid-width, 3 on wide viewports.

## Files

- `Block.tsx` — the reusable, props-driven component (`FeatureGridBlock`). Copy this into your app.
- `meta.ts` — registry metadata (label, category, recipe) that drives the blocks gallery.

## Use it

```tsx
import { FeatureGridBlock } from "@/client/blocks/feature-grid/Block";

<FeatureGridBlock
  items={[
    { icon: "zap", title: "Fast", description: "Ships in an afternoon." },
    { icon: "droplet", title: "Themed", description: "Reads the active theme." },
  ]}
/>
```

`items` defaults to a six-card sample set so `<FeatureGridBlock />` previews without configuration. `icon` is a Feather name from `@mrmeg/expo-ui/components/Icon`.

Column count comes from `useDimensions()` (SSR-seeded), not raw `useWindowDimensions()`, so the server render and the client's first render agree — see `docs/ssr-hydration.md` §4.
