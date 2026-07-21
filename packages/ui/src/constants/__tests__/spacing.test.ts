/**
 * spacing constants tests
 *
 * Locks in the radius scale (rebased to a 12px default) and its ordering.
 */

import {
  spacing,
  radiusNone,
  radiusXs,
  radiusSm,
  radiusMd,
  radiusLg,
  radiusXl,
  radius2xl,
  radiusFull,
} from "../spacing";

describe("radius scale", () => {
  it("exposes the rebased radius tokens", () => {
    expect(spacing.radiusNone).toBe(0);
    expect(spacing.radiusXs).toBe(4);
    expect(spacing.radiusSm).toBe(8);
    expect(spacing.radiusMd).toBe(12);
    expect(spacing.radiusLg).toBe(14);
    expect(spacing.radiusXl).toBe(18);
    expect(spacing.radius2xl).toBe(24);
    expect(spacing.radiusFull).toBe(9999);
  });

  it("increases monotonically from none to 2xl", () => {
    const scale = [
      spacing.radiusNone,
      spacing.radiusXs,
      spacing.radiusSm,
      spacing.radiusMd,
      spacing.radiusLg,
      spacing.radiusXl,
      spacing.radius2xl,
    ];

    for (let i = 1; i < scale.length; i++) {
      expect(scale[i]).toBeGreaterThan(scale[i - 1]);
    }
  });

  it("re-exports each radius token individually", () => {
    expect(radiusNone).toBe(spacing.radiusNone);
    expect(radiusXs).toBe(spacing.radiusXs);
    expect(radiusSm).toBe(spacing.radiusSm);
    expect(radiusMd).toBe(spacing.radiusMd);
    expect(radiusLg).toBe(spacing.radiusLg);
    expect(radiusXl).toBe(spacing.radiusXl);
    expect(radius2xl).toBe(spacing.radius2xl);
    expect(radiusFull).toBe(spacing.radiusFull);
  });
});
