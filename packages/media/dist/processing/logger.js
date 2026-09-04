/**
 * Development-only diagnostics for the processing pipeline.
 *
 * This used to be an injectable sink that no consumer ever configured, so every
 * call site was silently dead. It is now a plain `__DEV__` console logger: in a
 * release bundle the guard is statically false and the calls drop out, and in
 * development the pipeline actually talks.
 */
function isDev() {
    // Test runners set __DEV__ too; keeping suites quiet is worth the extra check.
    const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
    if (nodeEnv === "test" || nodeEnv === "production")
        return false;
    if (typeof __DEV__ !== "undefined")
        return Boolean(__DEV__);
    // Non-RN hosts (Node tooling) have no __DEV__ global.
    return nodeEnv !== undefined;
}
export function logMediaDebug(message) {
    if (!isDev())
        return;
    console.log(`[expo-media] ${message}`);
}
