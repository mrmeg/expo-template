/**
 * motion constants tests
 *
 * Locks in the duration token values and their ordering.
 */

import { durations } from "../motion";
import * as constantsBarrel from "../index";

describe("durations", () => {
  it("exposes the expected duration tokens", () => {
    expect(durations).toEqual({
      instant: 75,
      fast: 150,
      normal: 200,
      slow: 300,
      slower: 500,
    });
  });

  it("orders tokens from shortest to longest", () => {
    const values = Object.values(durations);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it("is exported from the constants barrel", () => {
    expect(constantsBarrel.durations).toBe(durations);
  });
});
