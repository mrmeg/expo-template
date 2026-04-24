import type { ConfigContext, ExpoConfig } from "expo/config";

const withNativeBuildSettings = require("./plugins/withNativeBuildSettings");

const CHANNEL_BY_PROFILE: Record<string, string> = {
  development: "development",
  preview: "preview",
  production: "production",
};

function resolveUpdatesChannel(): string {
  const explicitChannel = process.env.EXPO_UPDATES_CHANNEL?.trim();

  if (explicitChannel) {
    return explicitChannel;
  }

  const publicChannel = process.env.EXPO_PUBLIC_CHANNEL?.trim();

  if (publicChannel) {
    return publicChannel;
  }

  const easBuildProfile = process.env.EAS_BUILD_PROFILE?.trim();

  if (easBuildProfile && CHANNEL_BY_PROFILE[easBuildProfile]) {
    return CHANNEL_BY_PROFILE[easBuildProfile];
  }

  return process.env.NODE_ENV === "development" ? "development" : "production";
}

function resolveBuildNodeHeapMb(): string {
  const configuredHeapMb = process.env.EXPO_BUILD_NODE_HEAP_MB?.trim();

  if (configuredHeapMb && /^\d+$/.test(configuredHeapMb)) {
    return configuredHeapMb;
  }

  return "32768";
}

function isSentryConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());
}

function basePlugins(): NonNullable<ExpoConfig["plugins"]> {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    [
      "expo-router",
      {
        origin: "",
        asyncRoutes: {
          web: false,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    "expo-font",
    "expo-web-browser",
    "expo-localization",
  ];

  if (isSentryConfigured()) {
    plugins.push("@sentry/react-native");
  }

  return plugins;
}

export default function appConfig(_: ConfigContext): ExpoConfig {
  const updatesChannel = resolveUpdatesChannel();
  const buildNodeHeapMb = resolveBuildNodeHeapMb();
  const buildNodeOptions = `--max-old-space-size=${buildNodeHeapMb}`;

  let config: ExpoConfig = {
    name: "template",
    slug: "template",
    version: "0.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mrmeg.template",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.mrmeg.template",
    },
    web: {
      bundler: "metro",
      output: "server",
      favicon: "./assets/images/favicon.png",
    },
    plugins: basePlugins(),
    experiments: {
      typedRoutes: true,
    },
    extra: {
      updatesChannel,
      buildNodeHeapMb,
    },
  };

  config = withNativeBuildSettings(config, {
    iosNodeOptions: buildNodeOptions,
    androidNodeArgs: ["node", buildNodeOptions],
  });

  return config;
}
