type DatePickerSheetHandlers = {
  onResolve: (date: Date | undefined) => void;
  onCancel: () => void;
};

const registry = new Map<
  string,
  DatePickerSheetHandlers & { createdAt: number }
>();
let nextId = 0;
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
const MAX_AGE_MS = 300000; // 5 minutes

// Periodically clean up stale entries
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function maybeStopCleanup() {
  if (registry.size === 0 && cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

function ensureCleanupRunning() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, handler] of registry.entries()) {
      if (now - handler.createdAt > MAX_AGE_MS) {
        // Invoke onCancel before deletion to notify caller
        if (typeof handler.onCancel === 'function') {
          try {
            handler.onCancel();
          } catch (error) {
            // Prevent errors from breaking cleanup
            console.warn(
              `[DatePickerRegistry] Error invoking onCancel for ${id}:`,
              error
            );
          }
        }
        registry.delete(id);
      }
    }
    maybeStopCleanup();
  }, CLEANUP_INTERVAL_MS);
}

export function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  registry.clear();
}

function createRequestId(): string {
  nextId += 1;
  return `date-picker-${nextId}`;
}

export function registerDatePickerSheetRequest(
  handlers: DatePickerSheetHandlers
): string {
  ensureCleanupRunning();
  const requestId = createRequestId();
  registry.set(requestId, { ...handlers, createdAt: Date.now() });
  return requestId;
}

export function resolveDatePickerSheetRequest(
  requestId: string,
  date: Date | undefined
): void {
  const handlers = registry.get(requestId);
  if (!handlers) return;
  registry.delete(requestId);
  handlers.onResolve(date);
  maybeStopCleanup();
}

export function cancelDatePickerSheetRequest(requestId: string): void {
  const handlers = registry.get(requestId);
  if (!handlers) return;
  registry.delete(requestId);
  handlers.onCancel();
  maybeStopCleanup();
}
