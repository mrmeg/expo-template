/**
 * Form primitive integration test.
 *
 * Exercises the trio adopters reach for first — `useForm` + `zodResolver`
 * + `FormTextInput` + `FormCheckbox` — through a small harness that mirrors
 * the showcase form demo. Asserts the Controller wiring (typed input
 * value lands in `onSubmit`), validation surfacing (Zod error message
 * shows up after submit), and that `FormProvider` accepts the `form`
 * object via the named prop (the same regression locked in by the
 * generator test).
 */

import "@/test/mockTheme";

import React from "react";
import { Pressable, Text } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { z } from "zod";

import {
  FormCheckbox,
  FormProvider,
  FormTextInput,
  useForm,
  zodResolver,
} from "..";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  newsletter: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

function Harness({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", newsletter: false },
  });
  return (
    <FormProvider form={form}>
      <FormTextInput name="name" control={form.control} label="Name" placeholder="Jane" />
      <FormCheckbox name="newsletter" control={form.control} label="Subscribe" />
      <Pressable onPress={form.handleSubmit(onSubmit)}>
        <Text>Submit</Text>
      </Pressable>
    </FormProvider>
  );
}

describe("FormProvider + FormTextInput + FormCheckbox", () => {
  it("submits the typed form value when validation passes", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText("Jane"), "Jane Doe");
    await act(async () => {
      fireEvent.press(screen.getByText("Submit"));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({ name: "Jane Doe", newsletter: false });
  });

  it("blocks submit and surfaces the Zod message when validation fails", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.press(screen.getByText("Submit"));
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required")).toBeTruthy();
  });
});
