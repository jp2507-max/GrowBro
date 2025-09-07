export function computeBackoffMs(
  attempt: number,
  baseMs = 1000,
  maxMs = 900_000
): number {
  const expo = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt)));
  const jitter = Math.floor(Math.random() * Math.min(expo, 1000));
  return expo + jitter;
}
