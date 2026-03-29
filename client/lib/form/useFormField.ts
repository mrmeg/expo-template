import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseControllerProps,
} from "react-hook-form";

/**
 * Wraps useController and returns a flat object with field helpers and error state.
 *
 * Usage:
 * ```ts
 * const { field, error, isTouched, isDirty } = useFormField({ name: "email" });
 * ```
 */
export function useFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: UseControllerProps<TFieldValues, TName>) {
  const { field, fieldState } = useController(props);

  return {
    field,
    error: fieldState.error?.message,
    isTouched: fieldState.isTouched,
    isDirty: fieldState.isDirty,
  };
}
