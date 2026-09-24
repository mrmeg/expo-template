/**
 * Interaction state tokens.
 *
 * One opacity for "pressed", one for "disabled", and the two press scales the
 * kit's pressables share, so a Button, a pressable Card and a row read as the
 * same system under the finger. Components layer these after their base
 * styles; a caller `style` still wins.
 */
export const interaction = {
  /** Opacity of a filled surface while pressed. */
  pressedOpacity: 0.85,
  /** Opacity of a disabled control and its label. */
  disabledOpacity: 0.5,
  /** Press scale for large surfaces (Button, Card, Item). */
  pressedScale: 0.97,
  /** Press scale for small controls (Switch, Checkbox, Toggle). */
  controlPressedScale: 0.92,
} as const;
