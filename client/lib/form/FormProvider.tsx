import React from "react";
import {
  FormProvider as RHFFormProvider,
  type UseFormReturn,
  type FieldValues,
} from "react-hook-form";

interface FormProviderProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  children: React.ReactNode;
}

export function FormProvider<T extends FieldValues>({
  form,
  children,
}: FormProviderProps<T>) {
  return <RHFFormProvider {...form}>{children}</RHFFormProvider>;
}

// Re-exports for convenience
export { useForm } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";
