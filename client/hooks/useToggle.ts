import { useState, useCallback } from "react";

/**
 * Simple boolean state hook with a stable `toggle` function.
 *
 * @param initial - Initial boolean value (default `false`)
 * @returns Tuple of `[value, toggle, setValue]`
 *
 * @example
 * ```tsx
 * const [isOpen, toggleOpen, setOpen] = useToggle(false);
 *
 * <Button onPress={toggleOpen}>Toggle</Button>
 * <Modal visible={isOpen} onClose={() => setOpen(false)} />
 * ```
 */
export function useToggle(
  initial: boolean = false
): [value: boolean, toggle: () => void, setValue: (value: boolean) => void] {
  const [value, setValue] = useState(initial);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return [value, toggle, setValue];
}
