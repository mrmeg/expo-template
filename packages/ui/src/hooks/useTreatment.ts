import {
  defaultTreatments,
  useThemeStore,
  type Treatment,
  type TreatmentOverrides,
} from "../state/themeStore";

/**
 * The active value of one component treatment: the host app's `setTreatments`
 * (or `applyLook`) override, else the package default (`defaultTreatments`,
 * the Refined look). One store subscription per component, re-rendering only
 * when that treatment changes.
 *
 * ```tsx
 * const selection = useTreatment("segmentedSelection"); // "surface" | "accent"
 * ```
 */
export function useTreatment<T extends Treatment>(treatment: T): Required<TreatmentOverrides>[T] {
  return useThemeStore(
    (s) => (s.treatmentOverrides[treatment] ?? defaultTreatments[treatment]) as Required<TreatmentOverrides>[T],
  );
}
