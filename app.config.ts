import type { ConfigContext, ExpoConfig } from "expo/config";
import { getAppIdentity } from "./app.identity";

const withNativeBuildSettings = require("./plugins/withNativeBuildSettings");

function resolveBuildNodeHeapMb(): string {
  const configuredHeapMb = process.env.EXPO_BUILD_NODE_HEAP_MB?.trim();

  if (configuredHeapMb && /^\d+$/.test(configuredHeapMb)) {
    return configuredHeapMb;
  }

  return "32768";
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value || undefined;
}

function readSentryNativeUploadConfig(): { organization: string; project: string } | null {
  const authToken = readOptionalEnv("SENTRY_AUTH_TOKEN");
  const organization = readOptionalEnv("SENTRY_ORG");
  const project = readOptionalEnv("SENTRY_PROJECT");

  if (!authToken || !organization || !project) {
    return null;
  }

  return { organization, project };
}

function basePlugins(): NonNullable<ExpoConfig["plugins"]> {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    [
      "expo-router",
      {
        origin: "",
        // Render routes on the server per request instead of shipping the
        // export-time HTML shell, and enable route `loader` exports. SDK 58
        // stabilized middleware (`app/+middleware.ts` runs with no flag), but
        // @expo/cli 58 still reads these two flags in its dev server, static
        // export, and server-route middleware, so they stay until Expo
        // promotes them.
        unstable_useServerRendering: true,
        unstable_useServerDataLoaders: true,
        // Split route code into per-route chunks on web production exports so
        // the entry bundle stops statically containing every route (and its
        // route-only dependencies). Still opt-in on SDK 58: unset resolves to
        // false. Omitting `ios`/`android`/`default` keeps dev servers and
        // native builds on synchronous routes.
        asyncRoutes: { web: "production" },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        // Each scheme launches on its own background (`background` /
        // `surfaceSunken` from the package palette) with the matching mark.
        dark: {
          image: "./assets/images/splash-icon-dark.png",
          backgroundColor: "#09090B",
        },
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
    "expo-image",
    "expo-web-browser",
    "expo-localization",
    "expo-secure-store",
  ];

  // Sentry's config plugins inject sentry-cli into native build phases for
  // debug-symbol and source-map upload. We only register them when the upload
  // credentials are present so the template builds clean before Sentry is
  // configured. Runtime tracking (client/lib/sentry.ts) is gated separately on
  // EXPO_PUBLIC_SENTRY_DSN and works without these plugins.
  const sentryNativeUpload = readSentryNativeUploadConfig();

  if (sentryNativeUpload) {
    plugins.push("@sentry/react-native");
    plugins.push([
      "@sentry/react-native/expo",
      {
        organization: sentryNativeUpload.organization,
        project: sentryNativeUpload.project,
      },
    ]);
  }

  return plugins;
}

export default function appConfig(_: ConfigContext): ExpoConfig {
  const identity = getAppIdentity();
  const buildNodeHeapMb = resolveBuildNodeHeapMb();
  const buildNodeOptions = `--max-old-space-size=${buildNodeHeapMb}`;
  const easProjectId = readOptionalEnv("EAS_PROJECT_ID");

  let config: ExpoConfig = {
    name: identity.name,
    slug: identity.slug,
    version: "0.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: identity.scheme,
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: identity.iosBundleIdentifier,
      // iOS 18 icon appearances: the light icon is the full mark on its dark
      // tile, dark drops the tile (iOS supplies it), tinted is grayscale for
      // the system to tint. All three render from assets/brand/ via
      // `bun run brand:assets`.
      icon: {
        light: "./assets/images/icon.png",
        dark: "./assets/images/icon-dark.png",
        tinted: "./assets/images/icon-tinted.png",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        monochromeImage: "./assets/images/adaptive-icon-monochrome.png",
        backgroundColor: "#09090B",
      },
      package: identity.androidPackage,
    },
    web: {
      bundler: "metro",
      output: "server",
      favicon: "./assets/images/favicon.png",
    },
    plugins: basePlugins(),
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      buildNodeHeapMb,
      // Surface the active scheme on `Constants.expoConfig.extra.appScheme`
      // for any code path that prefers ExpoConfig over EXPO_PUBLIC_* env.
      appScheme: identity.scheme,
    },
  };

  // EAS Update stays inert until the template is linked to an EAS project.
  // `eas init` writes the project id; export it as EAS_PROJECT_ID (or set it in
  // EAS environment variables) to switch OTA updates on. Without it we omit
  // `extra.eas`, `updates`, and `runtimeVersion` entirely so `expo config` and
  // local builds keep working on a blank `.env`.
  if (easProjectId) {
    config.extra = {
      ...config.extra,
      eas: { projectId: easProjectId },
    };
    config.updates = {
      url: `https://u.expo.dev/${easProjectId}`,
    };
    // Fingerprint policy keeps the runtime version tied to the native
    // dependency graph, so an OTA update can never land on an incompatible
    // build. It requires expo-updates, which is installed.
    config.runtimeVersion = { policy: "fingerprint" };
  }

  config = withNativeBuildSettings(config, {
    iosNodeOptions: buildNodeOptions,
    androidNodeArgs: ["node", buildNodeOptions],
  });

  return config;
}
