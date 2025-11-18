import {
  addCrash,
  anonymizeAndTruncate,
  getCrashes,
} from '@/lib/privacy/crash-store';

function hasRedactedFlag(payload: unknown): payload is { redacted: boolean } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'redacted' in payload &&
    typeof (payload as { redacted: unknown }).redacted === 'boolean'
  );
}

test('anonymize older crashes', () => {
  const now = Date.now();
  addCrash({
    id: '1',
    createdAt: now - 200 * 24 * 60 * 60 * 1000,
    payload: { user: 'abc@x.com' },
  });
  addCrash({
    id: '2',
    createdAt: now - 10 * 24 * 60 * 60 * 1000,
    payload: { ok: true },
  });
  const changed = anonymizeAndTruncate(now - 180 * 24 * 60 * 60 * 1000);
  expect(changed).toBeGreaterThanOrEqual(1);
  const list = getCrashes();
  expect(
    list.some(
      (c) => c.id === '1' && hasRedactedFlag(c.payload) && c.payload.redacted
    )
  ).toBe(true);
});
