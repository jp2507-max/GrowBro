type DatePickerSheetHandlers = {
  onResolve: (date: Date | undefined) => void;
  onCancel: () => void;
};

const registry = new Map<string, DatePickerSheetHandlers>();
let nextId = 0;

function createRequestId(): string {
  nextId += 1;
  return `date-picker-${nextId}`;
}

export function registerDatePickerSheetRequest(
  handlers: DatePickerSheetHandlers
): string {
  const requestId = createRequestId();
  registry.set(requestId, handlers);
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
}

export function cancelDatePickerSheetRequest(requestId: string): void {
  const handlers = registry.get(requestId);
  if (!handlers) return;
  registry.delete(requestId);
  handlers.onCancel();
}
