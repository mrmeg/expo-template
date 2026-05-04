let debugLogger = null;
export function configureMediaDebugLogger(logger) {
    debugLogger = logger;
}
export function logMediaDebug(message) {
    debugLogger?.(message);
}
