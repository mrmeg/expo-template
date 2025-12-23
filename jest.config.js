/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",

  // Setup files run after test environment is set up
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],

  // Module path aliases matching tsconfig
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // Transform files with babel
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@rn-primitives/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native)",
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
  collectCoverageFrom: [
    "client/**/*.{ts,tsx}",
    "!client/**/*.d.ts",
    "!client/**/index.ts",
    "!client/devtools/**",
    "!**/node_modules/**",
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
