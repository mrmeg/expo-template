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

function showHelp() {
  log("\nUsage: npm run generate <type> <name>\n", "blue");
  log("Types:", "yellow");
  log("  component  - Create a new UI component in client/components/ui/");
  log("  screen     - Create a new screen in app/(main)/");
  log("\nExamples:", "yellow");
  log("  npm run generate component MyButton");
  log("  npm run generate screen Settings");
  log("  npm run generate component user-avatar");
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

  const pascalName = toPascalCase(name);
  const projectRoot = path.resolve(__dirname, "..");

  switch (type.toLowerCase()) {
  case "component": {
    const destDir = path.join(projectRoot, "client", "components", "ui");
    const destFile = path.join(destDir, `${pascalName}.tsx`);

    if (fs.existsSync(destFile)) {
      log(`Error: Component ${pascalName}.tsx already exists.`, "red");
      process.exit(1);
    }

    const content = getComponentTemplate(name);
    fs.writeFileSync(destFile, content);
    log(`\nCreated component: client/components/ui/${pascalName}.tsx`, "green");
    log("\nUsage:", "gray");
    log(`  import { ${pascalName} } from "@/client/components/ui/${pascalName}";`, "gray");
    log(`  <${pascalName} />`, "gray");
    break;
  }

  case "screen": {
    const destDir = path.join(projectRoot, "app", "(main)");
    const fileName = name.toLowerCase();
    const destFile = path.join(destDir, `${fileName}.tsx`);

    if (fs.existsSync(destFile)) {
      log(`Error: Screen ${fileName}.tsx already exists.`, "red");
      process.exit(1);
    }

    const content = getScreenTemplate(name);
    fs.writeFileSync(destFile, content);
    log(`\nCreated screen: app/(main)/${fileName}.tsx`, "green");
    log(`\nAccess at: /(main)/${fileName}`, "gray");
    log("\nDon't forget to add the screen to the Stack in app/(main)/_layout.tsx if needed.", "yellow");
    break;
  }

  default:
    log(`Error: Unknown type "${type}". Use "component" or "screen".`, "red");
    showHelp();
    process.exit(1);
  }

  log("");
}

main();
