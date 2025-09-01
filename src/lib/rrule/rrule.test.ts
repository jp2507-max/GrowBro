import { DateTime } from 'luxon';

import { buildIterator } from './iterator';
import { parseRule } from './parse';
import { validate } from './validate';

const BERLIN = 'Europe/Berlin';

function collect(iter: Iterable<{ local: Date; utc: Date }>) {
  return Array.from(iter).map((o) => ({
    local: DateTime.fromJSDate(o.local, { zone: BERLIN }).toISO(),
    utc: DateTime.fromJSDate(o.utc, { zone: 'utc' }).toISO(),
  }));
}

describe('RRULE v1.1', () => {
  it('parses DAILY with INTERVAL and validates', () => {
    const cfg = parseRule('FREQ=DAILY;INTERVAL=2', '2025-03-28T07:00:00Z');
    const res = validate({ ...cfg, dtstart: cfg.dtstart });
    expect(res.ok).toBe(true);
  });

  it('parses WEEKLY with BYDAY', () => {
    const cfg = parseRule(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH',
      '2025-03-24T07:00:00Z'
    );
    const res = validate(cfg);
    expect(res.ok).toBe(true);
  });

  it('rejects COUNT with UNTIL together', () => {
    const cfg = parseRule(
      'FREQ=DAILY;COUNT=3;UNTIL=2025-04-01T00:00:00Z',
      '2025-03-28T07:00:00Z'
    );
    const res = validate(cfg);
    expect(res.ok).toBe(false);
  });

  it('generates weekly MO/TH occurrences within range (Berlin DST window)', () => {
    const cfg = parseRule(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH',
      '2025-03-24T07:00:00Z'
    );
    const range = {
      start: DateTime.fromISO('2025-03-24T00:00:00', {
        zone: BERLIN,
      }).toJSDate(),
      end: DateTime.fromISO('2025-04-07T23:59:59', { zone: BERLIN }).toJSDate(),
      timezone: BERLIN,
    };
    const items = collect(buildIterator({ config: cfg, overrides: [], range }));
    expect(items.length).toBeGreaterThan(0);
    // Local time-of-day should follow DTSTART's local semantics (07:00Z == 08:00 CET)
    for (const it of items) {
      const local = DateTime.fromISO(it.local, { zone: BERLIN });
      expect(local.hour).toBe(8);
    }
  });

  it('applies skip override', () => {
    const cfg = parseRule('FREQ=DAILY;INTERVAL=1', '2025-03-28T07:00:00Z');
    const range = {
      start: DateTime.fromISO('2025-03-28T00:00:00', {
        zone: BERLIN,
      }).toJSDate(),
      end: DateTime.fromISO('2025-03-30T23:59:59', { zone: BERLIN }).toJSDate(),
      timezone: BERLIN,
    };
    const overrides = [
      {
        id: 'o1',
        seriesId: 's',
        occurrenceLocalDate: '2025-03-29',
        status: 'skip',
      } as any,
    ];
    const items = collect(buildIterator({ config: cfg, overrides, range }));
    const days = items.map((i) =>
      DateTime.fromISO(i.local, { zone: BERLIN }).toFormat('yyyy-LL-dd')
    );
    expect(days).not.toContain('2025-03-29');
  });
});
