import { create } from "zustand";

/**
 * drawerStore
 *
 * Global state store for drawer components.
 * Supports multiple drawer instances identified by unique IDs.
 *
 * Methods:
 * - open(id): opens the drawer with the given ID
 * - close(id): closes the drawer with the given ID
 * - toggle(id): toggles the drawer with the given ID
 * - isOpen(id): returns whether the drawer is open
 */

type DrawerState = {
  openDrawers: Set<string>;
};

type DrawerActions = {
  open: (id: string) => void;
  close: (id: string) => void;
  toggle: (id: string) => void;
  isOpen: (id: string) => boolean;
};

export const drawerStore = create<DrawerState & DrawerActions>((set, get) => ({
  openDrawers: new Set(),

  open: (id: string) => {
    set((state) => {
      const newSet = new Set(state.openDrawers);
      newSet.add(id);
      return { openDrawers: newSet };
    });
  },

  close: (id: string) => {
    set((state) => {
      const newSet = new Set(state.openDrawers);
      newSet.delete(id);
      return { openDrawers: newSet };
    });
  },

  toggle: (id: string) => {
    const isCurrentlyOpen = get().openDrawers.has(id);
    if (isCurrentlyOpen) {
      get().close(id);
    } else {
      get().open(id);
    }
  },

  isOpen: (id: string) => {
    return get().openDrawers.has(id);
  },
}));

// Hook for subscribing to a specific drawer's open state
export const useDrawerOpen = (id: string) => {
  return drawerStore((state) => state.openDrawers.has(id));
};
