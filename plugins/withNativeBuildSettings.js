const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const GENERATED_BLOCK_START = "# @generated begin expo-template-native-build-settings";
const GENERATED_BLOCK_END = "# @generated end expo-template-native-build-settings";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertGeneratedBlock(contents, block) {
  const normalized = contents.replace(/\r\n/g, "\n");
  const blockPattern = new RegExp(
    `${escapeRegExp(GENERATED_BLOCK_START)}[\\s\\S]*?${escapeRegExp(GENERATED_BLOCK_END)}\\n?`,
    "g",
  );
  const withoutExistingBlock = normalized.replace(blockPattern, "").trimEnd();

  return `${withoutExistingBlock}\n\n${block}\n`;
}

function formatGroovyStringList(values) {
  return `[${values.map((value) => `"${value}"`).join(", ")}]`;
}

function updateAndroidBuildGradle(contents, androidNodeArgs) {
  const nodeArgsLine = `    nodeExecutableAndArgs = ${formatGroovyStringList(androidNodeArgs)}`;

  if (contents.includes(nodeArgsLine)) {
    return contents;
  }

  if (/^\s*nodeExecutableAndArgs\s*=\s*\[[^\]]*\]\s*$/m.test(contents)) {
    return contents.replace(/^\s*nodeExecutableAndArgs\s*=\s*\[[^\]]*\]\s*$/m, nodeArgsLine);
  }

  if (contents.includes("// nodeExecutableAndArgs = [\"node\"]")) {
    return contents.replace("// nodeExecutableAndArgs = [\"node\"]", nodeArgsLine);
  }

  const anchor = "    bundleCommand = \"export:embed\"";
  if (!contents.includes(anchor)) {
    throw new Error("Unable to locate Expo bundleCommand in android/app/build.gradle");
  }

  return contents.replace(anchor, `${anchor}\n${nodeArgsLine}`);
}

const withNativeBuildSettings = (config, props) => {
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = updateAndroidBuildGradle(
      config.modResults.contents,
      props.androidNodeArgs,
    );
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const xcodeEnvPath = path.join(config.modRequest.platformProjectRoot, ".xcode.env");
      let existing = "";

      try {
        existing = await fs.readFile(xcodeEnvPath, "utf8");
      } catch (error) {
        if (error && error.code !== "ENOENT") {
          throw error;
        }
      }

      const managedBlock = [
        GENERATED_BLOCK_START,
        "# Generated from app.config.ts so CNG restores Xcode bundling settings on every prebuild.",
        `export NODE_OPTIONS="${props.iosNodeOptions}"`,
        GENERATED_BLOCK_END,
      ].join("\n");

      await fs.writeFile(xcodeEnvPath, upsertGeneratedBlock(existing, managedBlock));
      return config;
    },
  ]);

  return config;
};

module.exports = withNativeBuildSettings;
