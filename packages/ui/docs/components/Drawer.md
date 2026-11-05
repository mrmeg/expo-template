---
components: [Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, DrawerClose, DrawerToggleCollapse]
use-for: "Side panels and drawer navigation"
instead-of: "Custom sliding panels"
---

# Drawer

- `Drawer.Header` takes `icon`, `title`, and `action` slots for a compact app-brand row; put `Drawer.ToggleCollapse` in `action` for a trailing rail control. `Drawer.Content` owns safe-area top/bottom padding — do not duplicate it in children.

## Minimal Examples

```tsx
import { Drawer, Icon } from "@mrmeg/expo-ui/components";

<Drawer.Header
  icon={<Icon name="hexagon" color="accent" />}
  title="Acme"
  action={
    <Drawer.ToggleCollapse>
      <Icon name="panel-left" decorative />
    </Drawer.ToggleCollapse>
  }
/>
```
