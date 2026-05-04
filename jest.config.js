/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",

  // Setup files run after test environment is set up
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],

  // Module path aliases matching tsconfig
  moduleNameMapper: {
    "^@mrmeg/expo-ui$": "<rootDir>/packages/ui/src/index.ts",
    "^@mrmeg/expo-ui/components$": "<rootDir>/packages/ui/src/components/index.ts",
    "^@mrmeg/expo-ui/components/(.*)$": "<rootDir>/packages/ui/src/components/$1",
    "^@mrmeg/expo-ui/constants$": "<rootDir>/packages/ui/src/constants/index.ts",
    "^@mrmeg/expo-ui/hooks$": "<rootDir>/packages/ui/src/hooks/index.ts",
    "^@mrmeg/expo-ui/state$": "<rootDir>/packages/ui/src/state/index.ts",
    "^@mrmeg/expo-ui/lib$": "<rootDir>/packages/ui/src/lib/index.ts",
    "^@mrmeg/expo-media$": "<rootDir>/packages/media/src/index.ts",
    "^@mrmeg/expo-media/client$": "<rootDir>/packages/media/src/client/index.ts",
    "^@mrmeg/expo-media/react-query$": "<rootDir>/packages/media/src/react-query/index.ts",
    "^@mrmeg/expo-media/processing/image-compression$":
      "<rootDir>/packages/media/src/processing/imageCompression/index.ts",
    "^@mrmeg/expo-media/processing/image-compression/config$":
      "<rootDir>/packages/media/src/processing/imageCompression/config.ts",
    "^@mrmeg/expo-media/processing/video-conversion$":
      "<rootDir>/packages/media/src/processing/videoConversion/index.ts",
    "^@mrmeg/expo-media/processing/video-thumbnails$":
      "<rootDir>/packages/media/src/processing/videoThumbnails.ts",
    "^@mrmeg/expo-media/processing$": "<rootDir>/packages/media/src/processing/index.ts",
    "^@mrmeg/expo-media/server$": "<rootDir>/packages/media/src/server/index.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },

  // Transform files with babel
  transformIgnorePatterns: [
    "node_modules/(?!((\\.bun/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@rn-primitives/.*|@unimodules/.*|unimodules|sentry-expo|native-base)))",
  ],

  // Test file patterns
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],

  // Files to ignore during testing
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/ignite/",
    "<rootDir>/dist/",
  ],

  // Coverage configuration
  //
  // Covers both client-side code (the existing UI, features, hooks, and
  // stores) and the server-contract seams the night-shift specs kept
  // uncovering. API routes under `app/api/**` and the Express wiring under
  // `server/**` are included so CI flags drift in CORS, rate limiting,
  // auth bootstrap, or the FFmpeg worker path — the recurring failure
  // modes, not just happy-path UI.
  collectCoverageFrom: [
    "client/**/*.{ts,tsx}",
    "app/api/**/*.{ts,tsx}",
    "server/**/*.{js,ts}",
    "shared/**/*.{ts,tsx}",
    "packages/ui/src/**/*.{ts,tsx}",
    "packages/media/src/**/*.{ts,tsx}",
    "!client/**/*.d.ts",
    "!client/**/index.ts",
    "!client/devtools/**",
    "!app/api/**/index.ts",
    "!server/**/*.test.{js,ts}",
    "!shared/**/*.d.ts",
    "!packages/ui/src/**/index.ts",
    "!packages/media/src/**/index.ts",
    "!**/__tests__/**",
    "!**/node_modules/**",
    "!**/dist/**",
  ],

  // Coverage thresholds (optional - uncomment to enforce)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50,
  //   },
  // },

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,
};
