#!/usr/bin/env npx tsx
/**
 * Simple generator CLI for scaffolding components and screens.
 *
 * Usage:
 *   npx tsx scripts/generate.ts component MyButton
 *   npx tsx scripts/generate.ts screen Settings
 *
 * Or via npm script:
 *   npm run generate component MyButton
 *   npm run generate screen Settings
 */

import * as fs from "fs";
import * as path from "path";

// ANSI colors for terminal output
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

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^./, (char) => char.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Component template
function getComponentTemplate(name: string): string {
  const pascalName = toPascalCase(name);

  return `import { StyleProp, ViewStyle, StyleSheet, View } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText } from "@/client/components/ui/StyledText";
import type { Theme } from "@/client/constants/colors";

export interface ${pascalName}Props {
  /**
   * Optional style override
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * ${pascalName} component
 *
 * Usage:
 * \`\`\`tsx
 * <${pascalName} />
 * \`\`\`
 */
export function ${pascalName}({ style }: ${pascalName}Props) {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      <SansSerifText style={styles.text}>
        ${pascalName} Component
      </SansSerifText>
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

// Screen template
function getScreenTemplate(name: string): string {
  const pascalName = toPascalCase(name);

  return `import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import type { Theme } from "@/client/constants/colors";

/**
 * ${pascalName} screen
 */
export default function ${pascalName}Screen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.content}>
        <SansSerifBoldText style={styles.title}>
          ${pascalName}
        </SansSerifBoldText>
        <SansSerifText style={styles.description}>
          This is the ${pascalName} screen.
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

// Hook template
function getHookTemplate(name: string): string {
  const rawName = name.replace(/^use/i, "");
  const pascalName = toPascalCase(rawName);
  const hookName = `use${pascalName}`;

  return `import { useState, useEffect, useCallback } from "react";

interface ${hookName.charAt(0).toUpperCase() + hookName.slice(1)}Options {
  // TODO: Define hook options
}

/**
 * ${hookName}
 *
 * TODO: Describe what this hook does.
 *
 * @param options - Configuration options
 * @returns TODO: Describe return value
 *
 * @example
 * \`\`\`tsx
 * const result = ${hookName}();
 * \`\`\`
 */
export function ${hookName}(options: ${hookName.charAt(0).toUpperCase() + hookName.slice(1)}Options = {}) {
  // TODO: Implement hook logic

  return {};
}
`;
}

// Form template
function getFormTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `import { View, StyleSheet } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText } from "@/client/components/ui/StyledText";
import { TextInput } from "@/client/components/ui/TextInput";
import { Button } from "@/client/components/ui/Button";
import type { Theme } from "@/client/constants/colors";

const ${camelName}Schema = z.object({
  // TODO: Define your form fields
  // example: z.string().min(1, "Required"),
});

type ${pascalName}FormData = z.infer<typeof ${camelName}Schema>;

export interface ${pascalName}FormProps {
  /** Called when the form is submitted with valid data */
  onSubmit: (data: ${pascalName}FormData) => void;
  /** Whether the form is currently submitting */
  loading?: boolean;
}

/**
 * ${pascalName}Form
 *
 * Usage:
 * \`\`\`tsx
 * <${pascalName}Form onSubmit={(data) => console.log(data)} />
 * \`\`\`
 */
export function ${pascalName}Form({ onSubmit, loading = false }: ${pascalName}FormProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { control, handleSubmit, formState: { errors } } = useForm<${pascalName}FormData>({
    resolver: zodResolver(${camelName}Schema),
    defaultValues: {
      // TODO: Set default values
    },
  });

  return (
    <View style={styles.container}>
      {/* TODO: Add form fields using Controller */}
      {/*
      <Controller
        control={control}
        name="example"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            label="Example"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!errors.example}
            errorText={errors.example?.message}
          />
        )}
      />
      */}

      <Button
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        fullWidth
      >
        Submit
      </Button>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
  });
`;
}

function validateName(name: string): { valid: boolean; warnings: string[] } {
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
    return { valid: false, warnings: ["Name can only contain letters, numbers, hyphens, and underscores."] };
  }
  if (name !== toPascalCase(name) && !name.includes("-") && !name.includes("_")) {
    warnings.push(`Name "${name}" is not PascalCase. It will be converted to "${toPascalCase(name)}".`);
  }

  return { valid: true, warnings };
}

function showHelp() {
  log("\nUsage: npm run generate <type> <name>\n", "blue");
  log("Types:", "yellow");
  log("  component  - Create a new UI component in client/components/ui/");
  log("  screen     - Create a new screen in app/(main)/");
  log("  hook       - Create a new hook in client/hooks/");
  log("  form       - Create a new form component in client/components/forms/");
  log("\nExamples:", "yellow");
  log("  npm run generate component MyButton");
  log("  npm run generate screen Settings");
  log("  npm run generate hook Debounce");
  log("  npm run generate form ContactInfo");
  log("");
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  const [type, name] = args;

  if (!type || !name) {
    log("Error: Both type and name are required.", "red");
    showHelp();
    process.exit(1);
  }

  const { valid, warnings } = validateName(name);
  for (const w of warnings) {
    log(`Warning: ${w}`, "yellow");
  }
  if (!valid) {
    process.exit(1);
  }

  const pascalName = toPascalCase(name);
  const projectRoot = path.resolve(__dirname, "..");

  switch (type.toLowerCase()) {
  case "component": {
    const destDir = path.join(projectRoot, "client", "components", "ui");
    const destFile = path.join(destDir, `${pascalName}.tsx`);

    if (fs.existsSync(destFile)) {
      log(`Error: Component ${pascalName}.tsx already exists at client/components/ui/${pascalName}.tsx`, "red");
      log("  To overwrite, delete the existing file first.", "gray");
      process.exit(1);
    }

    const content = getComponentTemplate(name);
    fs.writeFileSync(destFile, content);
    log(`\nCreated component: client/components/ui/${pascalName}.tsx`, "green");
    log("\nImport:", "gray");
    log(`  import { ${pascalName} } from "@/client/components/ui/${pascalName}";`, "gray");
    break;
  }

  case "screen": {
    const destDir = path.join(projectRoot, "app", "(main)");
    const fileName = name.toLowerCase();
    const destFile = path.join(destDir, `${fileName}.tsx`);

    if (fs.existsSync(destFile)) {
      log(`Error: Screen ${fileName}.tsx already exists at app/(main)/${fileName}.tsx`, "red");
      log("  To overwrite, delete the existing file first.", "gray");
      process.exit(1);
    }

    const content = getScreenTemplate(name);
    fs.writeFileSync(destFile, content);
    log(`\nCreated screen: app/(main)/${fileName}.tsx`, "green");
    log(`\nAccess at: /(main)/${fileName}`, "gray");
    log("\nDon't forget to add the screen to the Stack in app/(main)/_layout.tsx if needed.", "yellow");
    break;
  }

  case "hook": {
    const rawName = name.replace(/^use/i, "");
    const hookPascal = toPascalCase(rawName);
    const hookName = `use${hookPascal}`;
    const destDir = path.join(projectRoot, "client", "hooks");
    const destFile = path.join(destDir, `${hookName}.ts`);

    if (fs.existsSync(destFile)) {
      log(`Error: Hook ${hookName}.ts already exists at client/hooks/${hookName}.ts`, "red");
      log("  To overwrite, delete the existing file first.", "gray");
      process.exit(1);
    }

    const content = getHookTemplate(name);
    fs.writeFileSync(destFile, content);
    log(`\nCreated hook: client/hooks/${hookName}.ts`, "green");
    log("\nImport:", "gray");
    log(`  import { ${hookName} } from "@/client/hooks/${hookName}";`, "gray");
    break;
  }

  case "form": {
    const destDir = path.join(projectRoot, "client", "components", "forms");
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destFile = path.join(destDir, `${pascalName}Form.tsx`);

    if (fs.existsSync(destFile)) {
      log(`Error: Form ${pascalName}Form.tsx already exists at client/components/forms/${pascalName}Form.tsx`, "red");
      log("  To overwrite, delete the existing file first.", "gray");
      process.exit(1);
    }

    const content = getFormTemplate(name);
    fs.writeFileSync(destFile, content);
    log(`\nCreated form: client/components/forms/${pascalName}Form.tsx`, "green");
    log("\nImport:", "gray");
    log(`  import { ${pascalName}Form } from "@/client/components/forms/${pascalName}Form";`, "gray");
    log("\nNote: This template requires additional dependencies.", "yellow");
    log("  Run: bun add react-hook-form zod @hookform/resolvers", "yellow");
    break;
  }

  default:
    log(`Error: Unknown type "${type}". Use "component", "screen", "hook", or "form".`, "red");
    showHelp();
    process.exit(1);
  }

  log("");
}

main();
