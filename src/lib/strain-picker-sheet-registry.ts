type StrainPickerHandlers<T> = {
  onResolve: (value: T) => void;
  onCancel: () => void;
};

type RegistryEntry<T> = StrainPickerHandlers<T> & { createdAt: number };

const registry = new Map<string, RegistryEntry<unknown>>();
let nextId = 0;
const CLEANUP_INTERVAL_MS = 60000;
const MAX_AGE_MS = 300000;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, handler] of registry.entries()) {
      if (now - handler.createdAt > MAX_AGE_MS) {
        if (typeof handler.onCancel === 'function') {
          try {
            handler.onCancel();
          } catch (error) {
            console.warn(
              `[StrainPickerRegistry] Error invoking onCancel for ${id}:`,
              error
            );
          }
        }
        registry.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export function stopStrainPickerRegistryCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  registry.clear();
}

function createRequestId(): string {
  nextId += 1;
  return `strain-picker-${nextId}`;
}

export function registerStrainPickerRequest<T>(
  handlers: StrainPickerHandlers<T>
): string {
  startCleanup();
  const requestId = createRequestId();
  registry.set(requestId, {
    ...(handlers as StrainPickerHandlers<unknown>),
    createdAt: Date.now(),
  });
  return requestId;
}

export function resolveStrainPickerRequest<T>(
  requestId: string,
  value: T
): void {
  const handlers = registry.get(requestId) as RegistryEntry<T> | undefined;
  if (!handlers) return;
  registry.delete(requestId);
  handlers.onResolve(value);
}

export function cancelStrainPickerRequest(requestId: string): void {
  const handlers = registry.get(requestId);
  if (!handlers) return;
  registry.delete(requestId);
  handlers.onCancel();
}
