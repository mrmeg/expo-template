/**
 * Unit tests for the scaffold generator's pure helpers.
 *
 * The CLI side of `scripts/generate.ts` (filesystem writes, collision
 * detection) is covered by manually running `bun run generate <type> <name>`
 * — duplicate protection guards against unintentional overwrites in the
 * checked-in tree, which is hard to exercise from Jest without mocking
 * `fs`. The pure helpers below cover everything that varies per generator
 * type: path decisions, name normalization, and the actual content the
 * caller will read from disk.
 */

import {
  getPlannedFiles,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  validateName,
} from "../generate";

describe("name normalization helpers", () => {
  it("toPascalCase lifts the first character and strips delimiters", () => {
    expect(toPascalCase("button")).toBe("Button");
    expect(toPascalCase("contactInfo")).toBe("ContactInfo");
    expect(toPascalCase("contact-info")).toBe("ContactInfo");
    expect(toPascalCase("contact_info")).toBe("ContactInfo");
    expect(toPascalCase("ContactInfo")).toBe("ContactInfo");
  });

  it("toCamelCase lowercases the first character of the PascalCase form", () => {
    expect(toCamelCase("ContactInfo")).toBe("contactInfo");
    expect(toCamelCase("contact-info")).toBe("contactInfo");
    expect(toCamelCase("button")).toBe("button");
  });

  it("toKebabCase splits on case boundaries and underscores", () => {
    expect(toKebabCase("ContactInfo")).toBe("contact-info");
    expect(toKebabCase("contact_info")).toBe("contact-info");
    expect(toKebabCase("contact-info")).toBe("contact-info");
    expect(toKebabCase("settings")).toBe("settings");
    expect(toKebabCase("HTTPSConfig")).toBe("httpsconfig");
  });
});

describe("validateName", () => {
  it("accepts plain PascalCase names without warnings", () => {
    expect(validateName("Button")).toEqual({ valid: true, warnings: [] });
    expect(validateName("ContactInfo")).toEqual({ valid: true, warnings: [] });
  });

  it("accepts kebab and snake case but is silent (delimiters carry intent)", () => {
    expect(validateName("contact-info")).toEqual({ valid: true, warnings: [] });
    expect(validateName("contact_info")).toEqual({ valid: true, warnings: [] });
  });

  it("warns when a delimiter-free name is not already PascalCase", () => {
    const result = validateName("button");
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("PascalCase");
    expect(result.warnings[0]).toContain("Button");
  });

  it("rejects empty, whitespace, leading-digit, and invalid-character names", () => {
    expect(validateName("").valid).toBe(false);
    expect(validateName("   ").valid).toBe(false);
    expect(validateName("My Button").valid).toBe(false);
    expect(validateName("9Button").valid).toBe(false);
    expect(validateName("Button!").valid).toBe(false);
  });
});

describe("getPlannedFiles — component", () => {
  it("emits a single PascalCase tsx in the UI package", () => {
    const plan = getPlannedFiles("component", "MyButton");
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0].relativePath).toBe("packages/ui/src/components/MyButton.tsx");
    expect(plan.followUps[0]).toContain("@mrmeg/expo-ui/components/MyButton");
  });

  it("uses only the theme value from useTheme (no unused getShadowStyle)", () => {
    const { content } = getPlannedFiles("component", "MyButton").files[0];
    expect(content).toContain("const { theme } = useTheme();");
    expect(content).not.toContain("getShadowStyle");
  });

  it("normalizes kebab-case input to PascalCase in the path and exports", () => {
    const plan = getPlannedFiles("component", "my-button");
    expect(plan.files[0].relativePath).toBe("packages/ui/src/components/MyButton.tsx");
    expect(plan.files[0].content).toContain("export function MyButton");
  });
});

describe("getPlannedFiles — screen", () => {
  it("emits both a reusable component in client/screens and a kebab-cased demo route", () => {
    const plan = getPlannedFiles("screen", "AccountSettings");
    expect(plan.files.map((f) => f.relativePath)).toEqual([
      "client/screens/AccountSettingsScreen.tsx",
      "app/(main)/(demos)/screen-account-settings.tsx",
    ]);
  });

  it("the demo route renders the reusable screen component", () => {
    const plan = getPlannedFiles("screen", "Welcome");
    const demo = plan.files.find((f) => f.relativePath.startsWith("app/"))!;
    expect(demo.content).toContain(
      'import { WelcomeScreen } from "@/client/screens/WelcomeScreen";',
    );
    expect(demo.content).toContain("<WelcomeScreen />");
  });

  it("exports the reusable screen as a named export, not default", () => {
    const plan = getPlannedFiles("screen", "Welcome");
    const component = plan.files.find((f) => f.relativePath.startsWith("client/"))!;
    expect(component.content).toContain("export function WelcomeScreen");
    expect(component.content).not.toMatch(/export default/);
  });

  it("flags the next step of wiring the screen into navigation", () => {
    const plan = getPlannedFiles("screen", "Welcome");
    expect(plan.followUps.some((line) => /Stack|Explore|navigation/i.test(line))).toBe(true);
  });
});

describe("getPlannedFiles — hook", () => {
  it("strips a leading 'use' from the input so callers can pass either form", () => {
    const plan = getPlannedFiles("hook", "useDebounce");
    expect(plan.files[0].relativePath).toBe("client/hooks/useDebounce.ts");
    const otherForm = getPlannedFiles("hook", "Debounce");
    expect(otherForm.files[0].relativePath).toBe("client/hooks/useDebounce.ts");
  });

  it("contains a working implementation, not a TODO-only body", () => {
    const { content } = getPlannedFiles("hook", "Counter").files[0];
    expect(content).toContain("export function useCounter");
    expect(content).toContain("useState");
    expect(content).not.toContain("// TODO: Implement hook logic");
  });

  it("does not import unused React hooks", () => {
    const { content } = getPlannedFiles("hook", "Counter").files[0];
    expect(content).not.toContain("useEffect");
    expect(content).not.toContain("useCallback");
  });
});

describe("getPlannedFiles — form", () => {
  it("writes to client/components/forms/<Pascal>Form.tsx", () => {
    const plan = getPlannedFiles("form", "ContactInfo");
    expect(plan.files[0].relativePath).toBe(
      "client/components/forms/ContactInfoForm.tsx",
    );
  });

  it("uses the shared form primitives in @/client/lib/form", () => {
    const { content } = getPlannedFiles("form", "ContactInfo").files[0];
    expect(content).toContain('from "@/client/lib/form"');
    expect(content).toContain("FormProvider");
    expect(content).toContain("FormTextInput");
    expect(content).toContain("useForm");
    expect(content).toContain("zodResolver");
  });

  it("does not instruct the user to install dependencies that already exist", () => {
    const plan = getPlannedFiles("form", "ContactInfo");
    const followUpsJoined = plan.followUps.join("\n");
    expect(followUpsJoined).not.toMatch(/bun add react-hook-form/i);
    expect(followUpsJoined).not.toMatch(/additional dependencies/i);
  });

  it("ships a typed schema and infers FormData from it", () => {
    const { content } = getPlannedFiles("form", "ContactInfo").files[0];
    expect(content).toContain("z.object");
    expect(content).toContain("z.infer<typeof contactInfoSchema>");
    expect(content).toContain("export type ContactInfoFormData");
  });

  it("passes the form to FormProvider via the named `form` prop, not spread", () => {
    // Spreading would leak react-hook-form's UseFormReturn fields onto
    // <FormProvider/> as positional props and fail typechecking.
    const { content } = getPlannedFiles("form", "ContactInfo").files[0];
    expect(content).toContain("<FormProvider form={form}>");
    expect(content).not.toContain("<FormProvider {...form}>");
  });
});
