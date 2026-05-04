let debugLogger: ((message: string) => void) | null = null;

export function configureMediaDebugLogger(
  logger: ((message: string) => void) | null,
): void {
  debugLogger = logger;
}

export function logMediaDebug(message: string): void {
  debugLogger?.(message);
}
