/**
 * Development-only diagnostics for the processing pipeline.
 *
 * This used to be an injectable sink that no consumer ever configured, so every
 * call site was silently dead. It is now a plain `__DEV__` console logger: in a
 * release bundle the guard is statically false and the calls drop out, and in
 * development the pipeline actually talks.
 */
export declare function logMediaDebug(message: string): void;
