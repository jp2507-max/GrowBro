export type AlarmScheduleResult = { id: string; exact: boolean };

export async function scheduleInexact(
  when: Date,
  payload?: Record<string, unknown>
): Promise<AlarmScheduleResult> {
  // In a real implementation, use WorkManager or AlarmManager inexact
  // For now, return a deterministic stub id for tests and dev
  const id = `inexact-${when.getTime()}`;
  void payload;
  return { id, exact: false };
}

export async function requestExactIfJustified(
  _when: Date,
  _payload?: Record<string, unknown>
): Promise<AlarmScheduleResult> {
  // Policy default: do not request exact — fall back
  return { id: 'exact-denied-fallback', exact: false };
}
