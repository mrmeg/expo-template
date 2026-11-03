/**
 * Types for `@mrmeg/expo-metro`. Structural on purpose: the package depends on
 * neither `metro` nor `expo`, and `withBundleOptimizations` returns the type of
 * the config it was given, so `MetroConfig` from `expo/metro-config` passes
 * through unchanged.
 */

/** What a Metro resolver returns for a request. */
export type MetroResolution =
  | { type: "empty" }
  | { type: "sourceFile"; filePath: string }
  | { type: "assetFiles"; filePaths: readonly string[] };

/** Metro's `CustomResolver`, as far as this package touches it. */
export type MetroResolveRequest = (
  context: MetroResolverContext,
  moduleName: string,
  platform: string | null
) => MetroResolution;

export interface MetroResolverContext {
  readonly originModulePath: string;
  readonly customResolverOptions?: { readonly environment?: string; readonly [key: string]: unknown };
  readonly resolveRequest: MetroResolveRequest;
  readonly [key: string]: unknown;
}

export interface BundleOptimizationOptions {
  /**
   * Set `EXPO_UNSTABLE_TREE_SHAKING` and `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH` to
   * `"1"` when unset. A `0` already in the environment is kept. `false` leaves
   * both alone, for apps that set them only in web build scripts so native output
   * and OTA fingerprints stay unchanged. Default `true`.
   */
  treeShaking?: boolean;
  /** Resolve zod's own `../locales/index` import to an empty module in client bundles. Default `true`. */
  zodLocaleStub?: boolean;
}

export interface ZodLocaleBarrelRequest {
  moduleName: string;
  originModulePath?: string;
  /** `context.customResolverOptions.environment`: `"node"` and `"react-server"` are server bundles. */
  environment?: string;
}

/**
 * Sets the tree-shaking env flags and wraps `config.resolver.resolveRequest`.
 * Returns a new config of the same type; the input is not modified.
 */
export function withBundleOptimizations<T extends object>(config: T, options?: BundleOptimizationOptions): T;

/** The env flags `treeShaking` sets. */
export const TREE_SHAKING_ENV: readonly ["EXPO_UNSTABLE_TREE_SHAKING", "EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH"];

/** Whether the request is zod's own `../locales/index.{js,cjs}` import in a client bundle. */
export function isZodLocaleBarrelImport(request: ZodLocaleBarrelRequest): boolean;

/** `environment` is a Node bundle (`"node"` or `"react-server"`). */
export function isServerEnvironment(environment: string | undefined): boolean;

/** The package a module path belongs to (`@scope/name` for scoped), or `null`. */
export function packageOfModulePath(filePath: string): string | null;
