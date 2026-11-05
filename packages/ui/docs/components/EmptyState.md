---
components: [EmptyState]
use-for: "No-data or recoverable error regions"
instead-of: "One-off empty placeholders"
---

# EmptyState

Props: `icon`, `title`, `description`, `actionLabel`, `onAction`, `actionPreset`.

## Minimal Examples

```tsx
import { EmptyState, Progress, SkeletonCard } from "@mrmeg/expo-ui/components";

{isLoading ? <SkeletonCard /> : null}
<Progress value={65} variant="accent" />
<EmptyState icon="inbox" title="No messages" description="New messages will appear here." />
```
