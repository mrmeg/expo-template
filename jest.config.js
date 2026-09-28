/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",

  // Setup files run after test environment is set up
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],

  // The `@/*` alias from tsconfig. Workspace packages are not mapped: they
  // resolve through their own `exports` maps, and the resolver below enables the
  // repo-only `@mrmeg/source` condition that points those maps at `src`.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // The React Native preset's resolver plus the `@mrmeg/source` export
  // condition (see test/resolver.js for why it cannot be a
  // `testEnvironmentOptions.customExportConditions` entry).
  resolver: "<rootDir>/test/resolver.js",

  // Transform files with babel
  transformIgnorePatterns: [
    "node_modules/(?!((\\.bun/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@rn-primitives/.*|@unimodules/.*|unimodules|sentry-expo|native-base)))",
  ],

  // Test file patterns
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],

  // Files to ignore during testing
  //
  // `workers/` holds deployable Cloudflare Workers whose only runtime is
  // workerd. They have no jest-expo-compatible tests and their bundled
  // dependencies (wrangler) must not be walked by the app suite.
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/workers/",
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
    "packages/purchases/src/**/*.{ts,tsx}",
    "!client/**/*.d.ts",
    "!client/**/index.ts",
    "!app/api/**/index.ts",
    "!server/**/*.test.{js,ts}",
    "!shared/**/*.d.ts",
    "!packages/ui/src/**/index.ts",
    "!packages/media/src/**/index.ts",
    "!packages/purchases/src/**/index.ts",
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
