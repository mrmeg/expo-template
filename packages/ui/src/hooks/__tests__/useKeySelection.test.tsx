/**
 * useKeySelection: toggling, select-all, pruning keys that are no longer
 * visible, and the identity of the callbacks and of `selected`.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useKeySelection } from "../useKeySelection";

const KEYS = ["a", "b", "c", "d"];

const setup = (initial: readonly string[] = KEYS) =>
  renderHook(({ keys }: { keys: readonly string[] }) => useKeySelection(keys), { initialProps: { keys: initial } });

const sorted = (set: ReadonlySet<string>) => [...set].sort();

describe("useKeySelection", () => {
  it("starts empty", async () => {
    const { result } = await setup();

    expect(result.current.count).toBe(0);
    expect(sorted(result.current.selected)).toEqual([]);
    expect(result.current.allSelected).toBe(false);
    expect(result.current.someSelected).toBe(false);
    expect(result.current.isSelected("a")).toBe(false);
  });

  it("toggles a key on and off", async () => {
    const { result } = await setup();

    await act(async () => result.current.toggle("b"));
    expect(sorted(result.current.selected)).toEqual(["b"]);
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.someSelected).toBe(true);

    await act(async () => result.current.toggle("b"));
    expect(result.current.count).toBe(0);
    expect(result.current.isSelected("b")).toBe(false);
  });

  it("reports allSelected and someSelected", async () => {
    const { result } = await setup();

    await act(async () => result.current.toggle("a"));
    expect(result.current.someSelected).toBe(true);
    expect(result.current.allSelected).toBe(false);

    await act(async () => KEYS.slice(1).forEach(result.current.toggle));
    expect(result.current.allSelected).toBe(true);
    expect(result.current.someSelected).toBe(false);
  });

  it("toggleAll selects everything visible, then clears", async () => {
    const { result } = await setup();

    await act(async () => result.current.toggleAll());
    expect(sorted(result.current.selected)).toEqual(KEYS);
    expect(result.current.allSelected).toBe(true);

    await act(async () => result.current.toggleAll());
    expect(result.current.count).toBe(0);
  });

  it("toggleAll from a partial selection selects the rest", async () => {
    const { result } = await setup();
    await act(async () => result.current.toggle("a"));

    await act(async () => result.current.toggleAll());

    expect(sorted(result.current.selected)).toEqual(KEYS);
  });

  it("toggleAll with nothing visible selects nothing", async () => {
    const { result } = await setup([]);

    await act(async () => result.current.toggleAll());

    expect(result.current.count).toBe(0);
    expect(result.current.allSelected).toBe(false);
  });

  it("clear and remove deselect", async () => {
    const { result } = await setup();
    await act(async () => result.current.toggleAll());

    await act(async () => result.current.remove(["a", "c", "missing"]));
    expect(sorted(result.current.selected)).toEqual(["b", "d"]);

    await act(async () => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  describe("pruning", () => {
    it("drops selected keys that leave the visible list, at once", async () => {
      const { result, rerender } = await setup();
      await act(async () => result.current.toggleAll());

      await rerender({ keys: ["a", "b"] });

      expect(sorted(result.current.selected)).toEqual(["a", "b"]);
      expect(result.current.count).toBe(2);
      expect(result.current.isSelected("c")).toBe(false);
      expect(result.current.allSelected).toBe(true);
    });

    it("does not bring a pruned key back when it becomes visible again", async () => {
      const { result, rerender } = await setup();
      await act(async () => result.current.toggle("c"));
      await act(async () => result.current.toggle("a"));

      await rerender({ keys: ["a", "b"] });
      // The next change starts from the pruned set, so "c" is gone for good.
      await act(async () => result.current.toggle("b"));
      await rerender({ keys: KEYS });

      expect(sorted(result.current.selected)).toEqual(["a", "b"]);
    });

    it("keeps the selected Set when nothing was pruned", async () => {
      const { result, rerender } = await setup();
      await act(async () => result.current.toggle("a"));
      const before = result.current.selected;

      await rerender({ keys: [...KEYS] });
      expect(result.current.selected).toBe(before);

      await rerender({ keys: ["a", "b", "c", "d", "e"] });
      expect(result.current.selected).toBe(before);
    });

    it("keeps the same empty Set across renders", async () => {
      const { result, rerender } = await setup();
      const before = result.current.selected;

      await rerender({ keys: ["a"] });

      expect(result.current.selected).toBe(before);
    });

    it("prunes toggleAll's baseline: a hidden selection does not count as everything", async () => {
      const { result, rerender } = await setup();
      await act(async () => result.current.toggle("d"));
      await rerender({ keys: ["a", "b"] });

      await act(async () => result.current.toggleAll());

      expect(sorted(result.current.selected)).toEqual(["a", "b"]);
    });

    it("counts a duplicated key once", async () => {
      const { result } = await setup(["a", "a", "b"]);

      await act(async () => result.current.toggleAll());

      expect(result.current.count).toBe(2);
      expect(result.current.allSelected).toBe(true);
    });
  });

  describe("stable callbacks", () => {
    it("keeps toggle, toggleAll, clear and remove across selection and key changes", async () => {
      const { result, rerender } = await setup();
      const first = result.current;

      await act(async () => result.current.toggle("a"));
      await rerender({ keys: ["a", "b"] });

      expect(result.current.toggle).toBe(first.toggle);
      expect(result.current.toggleAll).toBe(first.toggleAll);
      expect(result.current.clear).toBe(first.clear);
      expect(result.current.remove).toBe(first.remove);
    });

    it("changes isSelected only when the selection changes", async () => {
      const { result, rerender } = await setup();
      const first = result.current.isSelected;

      await rerender({ keys: [...KEYS] });
      expect(result.current.isSelected).toBe(first);

      await act(async () => result.current.toggle("a"));
      expect(result.current.isSelected).not.toBe(first);
    });

    it("clear on an empty selection does not change `selected`", async () => {
      const { result } = await setup();
      const before = result.current.selected;

      await act(async () => result.current.clear());

      expect(result.current.selected).toBe(before);
    });
  });
});
