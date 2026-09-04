/**
 * The bound is the memory ceiling for a multi-select: one in-flight decode per
 * slot. These tests pin both halves of the contract — the bound is never
 * exceeded, and results stay in input order regardless of completion order.
 */

import { mapWithConcurrency } from "../concurrency";

/** Resolves after `ms` without relying on fake timers. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("mapWithConcurrency", () => {
  it("never runs more workers at once than the limit", async () => {
    const items = Array.from({ length: 12 }, (_, index) => index);
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(items, 3, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await delay(1);
      inFlight -= 1;
      return item;
    });

    expect(peak).toBe(3);
  });

  it("preserves input order even when workers finish out of order", async () => {
    const items = [30, 10, 20, 0];

    const results = await mapWithConcurrency(items, 4, async (item) => {
      await delay(item);
      return `done:${item}`;
    });

    expect(results).toEqual(["done:30", "done:10", "done:20", "done:0"]);
  });

  it("passes the index through to the worker", async () => {
    const results = await mapWithConcurrency(["a", "b", "c"], 2, async (item, index) =>
      `${index}:${item}`,
    );
    expect(results).toEqual(["0:a", "1:b", "2:c"]);
  });

  it("processes every item", async () => {
    const items = Array.from({ length: 25 }, (_, index) => index);
    const results = await mapWithConcurrency(items, 4, async (item) => item * 2);
    expect(results).toEqual(items.map((item) => item * 2));
  });

  it("returns an empty array for no items without calling the worker", async () => {
    const worker = jest.fn();
    await expect(mapWithConcurrency([], 3, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it.each([0, -5, Number.NaN])("treats the invalid limit %p as serial", async (limit) => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3], limit, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await delay(1);
      inFlight -= 1;
      return item;
    });

    expect(peak).toBe(1);
  });

  it("never spawns more workers than there are items", async () => {
    const started: number[] = [];
    await mapWithConcurrency([1, 2], 10, async (item) => {
      started.push(item);
      await delay(1);
      return item;
    });
    expect(started).toHaveLength(2);
  });

  it("rejects when a worker throws", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error("boom");
        return item;
      }),
    ).rejects.toThrow("boom");
  });
});
