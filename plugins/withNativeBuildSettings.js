const { withAppBuildGradle, withDangerousMod, withGradleProperties } = require("expo/config-plugins");
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

// R8 minification and resource shrinking for Android release builds. The generated
// `android/app/build.gradle` reads both flags from gradle.properties and defaults them
// off, so without this mod every project cut from the template ships an unminified
// release APK/AAB.
const ANDROID_RELEASE_GRADLE_PROPERTIES = [
  {
    key: "android.enableMinifyInReleaseBuilds",
    value: "true",
    comment: "Run R8 on release builds (shrink, optimize, and obfuscate Java/Kotlin code).",
  },
  {
    key: "android.enableShrinkResourcesInReleaseBuilds",
    value: "true",
    comment: "Strip resources unreachable from the minified code out of release builds.",
  },
];

function upsertGradleProperty(properties, { key, value, comment }) {
  const existingIndex = properties.findIndex(
    (item) => item.type === "property" && item.key === key,
  );

  if (existingIndex !== -1) {
    properties[existingIndex] = { type: "property", key, value };
    return properties;
  }

  properties.push({ type: "empty" });
  properties.push({ type: "comment", value: comment });
  properties.push({ type: "property", key, value });

  return properties;
}

// Pin the Gradle daemon to JDK 17 via the daemon JVM criteria file. The criteria
// file outranks every other JVM selection mechanism — JAVA_HOME,
// org.gradle.java.home, and crucially Android Studio's "Gradle JDK" setting
// (which defaults to its bundled JetBrains Runtime, currently JDK 25). On
// JDK 24+ the JVM prints a JEP-472 native-access warning on stderr when AGP's
// prefab tool runs, and AGP treats any prefab stderr as fatal — every
// configureCMake* task fails. Always writing the pin keeps terminal and
// Android Studio builds on the same working JDK. Requires a local JDK 17
// (no toolchainUrl entries: generating them needs the foojay resolver, and a
// missing-JDK failure is a clear actionable error).
const DAEMON_JVM_VERSION = "17";

const withDaemonJvmVersion = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const criteriaPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle",
        "gradle-daemon-jvm.properties",
      );
      await fs.mkdir(path.dirname(criteriaPath), { recursive: true });
      await fs.writeFile(
        criteriaPath,
        "# Written by plugins/withNativeBuildSettings.js — pins the Gradle daemon JVM\n" +
          `# (including Android Studio builds) to JDK ${DAEMON_JVM_VERSION}. JDK 24+ JEP-472 stderr\n` +
          `# warnings break AGP's prefab step. Requires a local JDK ${DAEMON_JVM_VERSION}.\n` +
          `toolchainVersion=${DAEMON_JVM_VERSION}\n`,
      );
      return config;
    },
  ]);
};

const withNativeBuildSettings = (config, props) => {
  config = withGradleProperties(config, (config) => {
    for (const property of ANDROID_RELEASE_GRADLE_PROPERTIES) {
      config.modResults = upsertGradleProperty(config.modResults, property);
    }
    return config;
  });

  config = withDaemonJvmVersion(config);

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
