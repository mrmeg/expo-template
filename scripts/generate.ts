#!/usr/bin/env npx tsx
/**
 * Generator CLI for scaffolding components, screens, hooks, and forms.
 *
 * Usage:
 *   npx tsx scripts/generate.ts component MyButton
 *   npx tsx scripts/generate.ts screen Settings
 *   npx tsx scripts/generate.ts hook Debounce
 *   npx tsx scripts/generate.ts form ContactInfo
 *
 * Or via the npm script:
 *   bun run generate component MyButton
 *
 * Pure helpers (`getPlannedFiles`, `validateName`, `toPascalCase`,
 * `toKebabCase`, etc.) are exported separately so the CLI behavior can be
 * unit-tested without writing files. `main()` only runs when this module is
 * the process entry point.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^./, (char) => char.toUpperCase());
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
  return toPascalCase(str)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export type GeneratorType = "component" | "screen" | "hook" | "form";

export interface PlannedFile {
  /** Relative path from the project root. */
  relativePath: string;
  content: string;
}

export interface PlannedGeneration {
  type: GeneratorType;
  files: PlannedFile[];
  /** Lines printed after a successful write (import paths, next steps). */
  followUps: string[];
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function componentTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `import { StyleProp, ViewStyle, StyleSheet, View } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";

export interface ${pascalName}Props {
  /** Optional style override applied to the outer container. */
  style?: StyleProp<ViewStyle>;
}

/**
 * ${pascalName} component.
 *
 * Usage:
 * \`\`\`tsx
 * <${pascalName} />
 * \`\`\`
 */
export function ${pascalName}({ style }: ${pascalName}Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      <SansSerifText style={styles.text}>${pascalName} Component</SansSerifText>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      padding: spacing.md,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    text: {
      color: theme.colors.foreground,
    },
  });
`;
}

function screenComponentTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";

export interface ${pascalName}ScreenProps {
  /** Optional style override applied to the SafeAreaView container. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable ${pascalName} screen template. Render directly from a route or
 * compose with other ${pascalName} variants in \`app/(main)/\`.
 */
export function ${pascalName}Screen({ style }: ${pascalName}ScreenProps = {}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={[styles.container, style]} edges={["bottom"]}>
      <View style={styles.content}>
        <SansSerifBoldText style={styles.title}>${pascalName}</SansSerifBoldText>
        <SansSerifText style={styles.description}>
          This is the ${pascalName} screen template.
        </SansSerifText>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    title: {
      fontSize: 24,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: 16,
      color: theme.colors.foreground,
      opacity: 0.7,
    },
  });
`;
}

function screenDemoRouteTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `import { ${pascalName}Screen } from "@/client/screens/${pascalName}Screen";

export default function ${pascalName}DemoRoute() {
  return <${pascalName}Screen />;
}
`;
}

function hookTemplate(name: string): string {
  const rawName = name.replace(/^use/i, "");
  const pascalName = toPascalCase(rawName);
  const hookName = `use${pascalName}`;
  const optionsType = `${pascalName}Options`;
  const resultType = `${pascalName}Result`;

  return `import { useState } from "react";

export interface ${optionsType} {
  /** Initial value returned by the hook. */
  initialValue?: number;
}

export interface ${resultType} {
  value: number;
  setValue: (next: number) => void;
}

/**
 * ${hookName} — minimal scaffold returning a controlled value.
 * Replace with the real implementation for this hook.
 *
 * @example
 * \`\`\`tsx
 * const { value, setValue } = ${hookName}();
 * \`\`\`
 */
export function ${hookName}(options: ${optionsType} = {}): ${resultType} {
  const [value, setValue] = useState(options.initialValue ?? 0);
  return { value, setValue };
}
`;
}

function formTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  return `import { View, StyleSheet } from "react-native";
import { z } from "zod";
import {
  FormProvider,
  FormTextInput,
  useForm,
  zodResolver,
} from "@/client/lib/form";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { spacing } from "@mrmeg/expo-ui/constants";

const ${camelName}Schema = z.object({
  // Replace with the real fields for this form.
  example: z.string().min(1, "Required"),
});

export type ${pascalName}FormData = z.infer<typeof ${camelName}Schema>;

export interface ${pascalName}FormProps {
  /** Called when validation succeeds. */
  onSubmit: (data: ${pascalName}FormData) => void;
  /** Render the submit button in a loading state. */
  loading?: boolean;
}

/**
 * ${pascalName}Form — built on the shared form primitives in
 * \`@/client/lib/form\` so field components stay accessible and consistent.
 *
 * Usage:
 * \`\`\`tsx
 * <${pascalName}Form onSubmit={(data) => console.log(data)} />
 * \`\`\`
 */
export function ${pascalName}Form({ onSubmit, loading = false }: ${pascalName}FormProps) {
  const form = useForm<${pascalName}FormData>({
    resolver: zodResolver(${camelName}Schema),
    defaultValues: {
      example: "",
    },
  });

  return (
    <FormProvider form={form}>
      <View style={styles.container}>
        <FormTextInput
          name="example"
          control={form.control}
          label="Example"
          placeholder="Type something"
        />
        <Button onPress={form.handleSubmit(onSubmit)} loading={loading} fullWidth>
          Submit
        </Button>
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
`;
}

// ---------------------------------------------------------------------------
// Generation plans
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export function validateName(name: string): ValidationResult {
  const warnings: string[] = [];

  if (!name || name.trim().length === 0) {
    return { valid: false, warnings: ["Name cannot be empty."] };
  }
  if (/\s/.test(name)) {
    return { valid: false, warnings: ["Name cannot contain spaces."] };
  }
  if (/^\d/.test(name)) {
    return { valid: false, warnings: ["Name cannot start with a number."] };
  }
  if (/[^a-zA-Z0-9\-_]/.test(name)) {
    return {
      valid: false,
      warnings: ["Name can only contain letters, numbers, hyphens, and underscores."],
    };
  }
  if (name !== toPascalCase(name) && !name.includes("-") && !name.includes("_")) {
    warnings.push(
      `Name "${name}" is not PascalCase. It will be converted to "${toPascalCase(name)}".`,
    );
  }

  return { valid: true, warnings };
}

export function getPlannedFiles(type: GeneratorType, name: string): PlannedGeneration {
  const pascalName = toPascalCase(name);
  switch (type) {
  case "component": {
    const relativePath = `packages/ui/src/components/${pascalName}.tsx`;
    return {
      type,
      files: [{ relativePath, content: componentTemplate(name) }],
      followUps: [
        `import { ${pascalName} } from "@mrmeg/expo-ui/components/${pascalName}";`,
        `Export ${pascalName} from packages/ui/src/components/index.ts before publishing.`,
      ],
    };
  }
  case "screen": {
    const kebabName = toKebabCase(name);
    const componentPath = `client/screens/${pascalName}Screen.tsx`;
    const demoPath = `app/(main)/(demos)/screen-${kebabName}.tsx`;
    return {
      type,
      files: [
        { relativePath: componentPath, content: screenComponentTemplate(name) },
        { relativePath: demoPath, content: screenDemoRouteTemplate(name) },
      ],
      followUps: [
        `Reusable component: @/client/screens/${pascalName}Screen`,
        `Demo route: /(main)/(demos)/screen-${kebabName}`,
        "Wire it into the Explore tab or a Stack entry to expose it in navigation.",
      ],
    };
  }
  case "hook": {
    const rawName = name.replace(/^use/i, "");
    const hookPascal = toPascalCase(rawName);
    const hookName = `use${hookPascal}`;
    const relativePath = `client/hooks/${hookName}.ts`;
    return {
      type,
      files: [{ relativePath, content: hookTemplate(name) }],
      followUps: [
        `import { ${hookName} } from "@/client/hooks/${hookName}";`,
      ],
    };
  }
  case "form": {
    const relativePath = `client/components/forms/${pascalName}Form.tsx`;
    return {
      type,
      files: [{ relativePath, content: formTemplate(name) }],
      followUps: [
        `import { ${pascalName}Form } from "@/client/components/forms/${pascalName}Form";`,
        "Form primitives come from @/client/lib/form — no extra dependencies needed.",
      ],
    };
  }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function showHelp() {
  log("\nUsage: bun run generate <type> <name>\n", "blue");
  log("Types:", "yellow");
  log("  component  - Create a new UI component in packages/ui/src/components/");
  log("  screen     - Create a new reusable screen in client/screens/ + demo route in app/(main)/(demos)/");
  log("  hook       - Create a new hook in client/hooks/");
  log("  form       - Create a new form component in client/components/forms/ (uses @/client/lib/form primitives)");
  log("\nExamples:", "yellow");
  log("  bun run generate component MyButton");
  log("  bun run generate screen Settings");
  log("  bun run generate hook Debounce");
  log("  bun run generate form ContactInfo");
  log("");
}

function isGeneratorType(value: string): value is GeneratorType {
  return value === "component" || value === "screen" || value === "hook" || value === "form";
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  const [rawType, name] = args;

  if (!rawType || !name) {
    log("Error: Both type and name are required.", "red");
    showHelp();
    process.exit(1);
  }

  const type = rawType.toLowerCase();
  if (!isGeneratorType(type)) {
    log(`Error: Unknown type "${rawType}". Use "component", "screen", "hook", or "form".`, "red");
    showHelp();
    process.exit(1);
  }

  const { valid, warnings } = validateName(name);
  for (const w of warnings) log(`Warning: ${w}`, "yellow");
  if (!valid) process.exit(1);

  const plan = getPlannedFiles(type, name);
  const projectRoot = path.resolve(__dirname, "..");

  // Collision check before any writes — keeps the CLI atomic.
  for (const file of plan.files) {
    const abs = path.join(projectRoot, file.relativePath);
    if (fs.existsSync(abs)) {
      log(`Error: ${file.relativePath} already exists.`, "red");
      log("  To overwrite, delete the existing file first.", "gray");
      process.exit(1);
    }
  }

  for (const file of plan.files) {
    const abs = path.join(projectRoot, file.relativePath);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, file.content);
    log(`Created: ${file.relativePath}`, "green");
  }

  if (plan.followUps.length > 0) {
    log("");
    for (const line of plan.followUps) log(`  ${line}`, "gray");
  }

  log("");
}

if (require.main === module) {
  main();
}
