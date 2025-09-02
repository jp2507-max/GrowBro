/* eslint-disable max-lines-per-function */
import { DateTime } from 'luxon';

import { buildIterator } from './iterator';
import { parseRule } from './parse';
import { validate } from './validate';

const BERLIN = 'Europe/Berlin';

function collect(
  iter: Iterable<{ local: Date; utc: Date }>
): { local: string; utc: string }[] {
  return Array.from(iter).map((o) => ({
    local: DateTime.fromJSDate(o.local, { zone: BERLIN }).toISO()!,
    utc: DateTime.fromJSDate(o.utc, { zone: 'utc' }).toISO()!,
  }));
}

describe('RRULE Basic parsing and validation', () => {
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
});

describe('RRULE dtstart validation', () => {
  it('validates dtstart is a valid Date', () => {
    const validCfg = parseRule('FREQ=DAILY;INTERVAL=1', '2025-03-28T07:00:00Z');
    const validRes = validate(validCfg);
    expect(validRes.ok).toBe(true);

    // Test invalid dtstart
    const invalidCfg = { ...validCfg, dtstart: new Date('invalid') };
    const invalidRes = validate(invalidCfg);
    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.errors).toContain('dtstart must be a valid Date');

    // Test non-Date dtstart
    const nonDateCfg = {
      ...validCfg,
      dtstart: '2025-03-28T07:00:00Z' as any,
    };
    const nonDateRes = validate(nonDateCfg);
    expect(nonDateRes.ok).toBe(false);
    expect(nonDateRes.errors).toContain('dtstart must be a valid Date');
  });
});

describe('RRULE count validation', () => {
  it('validates count is an integer > 0', () => {
    const cfg = parseRule('FREQ=DAILY;COUNT=5', '2025-03-28T07:00:00Z');
    const validRes = validate(cfg);
    expect(validRes.ok).toBe(true);

    // Test count = 0
    const zeroCountCfg = { ...cfg, count: 0 } as any;
    const zeroCountRes = validate(zeroCountCfg);
    expect(zeroCountRes.ok).toBe(false);
    expect(zeroCountRes.errors).toContain('count must be an integer > 0');

    // Test negative count
    const negativeCountCfg = { ...cfg, count: -1 } as any;
    const negativeCountRes = validate(negativeCountCfg);
    expect(negativeCountRes.ok).toBe(false);
    expect(negativeCountRes.errors).toContain('count must be an integer > 0');

    // Test non-integer count
    const nonIntegerCountCfg = { ...cfg, count: 2.5 } as any;
    const nonIntegerCountRes = validate(nonIntegerCountCfg);
    expect(nonIntegerCountRes.ok).toBe(false);
    expect(nonIntegerCountRes.errors).toContain('count must be an integer > 0');
  });
});

describe('RRULE until validation', () => {
  it('validates until is a valid Date', () => {
    const cfg = parseRule(
      'FREQ=DAILY;UNTIL=2025-04-01T00:00:00Z',
      '2025-03-28T07:00:00Z'
    );
    const validRes = validate(cfg);
    expect(validRes.ok).toBe(true);

    // Test invalid until
    const invalidUntilCfg = { ...cfg, until: new Date('invalid') } as any;
    const invalidUntilRes = validate(invalidUntilCfg);
    expect(invalidUntilRes.ok).toBe(false);
    expect(invalidUntilRes.errors).toContain('until must be a valid Date');

    // Test non-Date until
    const nonDateUntilCfg = {
      ...cfg,
      until: '2025-04-01T00:00:00Z' as any,
    } as any;
    const nonDateUntilRes = validate(nonDateUntilCfg);
    expect(nonDateUntilRes.ok).toBe(false);
    expect(nonDateUntilRes.errors).toContain('until must be a valid Date');
  });

  it('validates until is after dtstart', () => {
    const cfg = parseRule(
      'FREQ=DAILY;UNTIL=2025-04-01T00:00:00Z',
      '2025-03-28T07:00:00Z'
    );
    const validRes = validate(cfg);
    expect(validRes.ok).toBe(true);

    // Test until before dtstart
    const earlyUntilCfg = {
      ...cfg,
      until: new Date('2025-03-27T07:00:00Z'),
    } as any;
    const earlyUntilRes = validate(earlyUntilCfg);
    expect(earlyUntilRes.ok).toBe(false);
    expect(earlyUntilRes.errors).toContain('until must be after dtstart');

    // Test until equal to dtstart
    const equalUntilCfg = {
      ...cfg,
      until: new Date('2025-03-28T07:00:00Z'),
    } as any;
    const equalUntilRes = validate(equalUntilCfg);
    expect(equalUntilRes.ok).toBe(false);
    expect(equalUntilRes.errors).toContain('until must be after dtstart');
  });
});

describe('RRULE DST and timezone handling', () => {
  it('generates weekly MO/TH occurrences within range (Berlin DST window)', () => {
    const cfg = parseRule(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH',
      '2025-03-24T07:00:00Z'
    );
    const range = {
      start: DateTime.fromISO('2025-03-24T00:00:00', {
        zone: BERLIN,
      }).toJSDate(),
      end: DateTime.fromISO('2025-04-07T23:59:59', {
        zone: BERLIN,
      }).toJSDate(),
      timezone: BERLIN,
    };
    const items = collect(buildIterator({ config: cfg, overrides: [], range }));
    expect(items.length).toBeGreaterThan(0);
    // Local time-of-day should follow DTSTART's local semantics (07:00Z == 08:00 CET)
    for (const it of items) {
      if (it.local) {
        const local = DateTime.fromISO(it.local, { zone: BERLIN });
        expect(local.hour).toBe(8);
      }
    }
  });
});

describe('RRULE overrides', () => {
  it('applies skip override', () => {
    const cfg = parseRule('FREQ=DAILY;INTERVAL=1', '2025-03-28T07:00:00Z');
    const range = {
      start: DateTime.fromISO('2025-03-28T00:00:00', {
        zone: BERLIN,
      }).toJSDate(),
      end: DateTime.fromISO('2025-03-30T23:59:59', {
        zone: BERLIN,
      }).toJSDate(),
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
    const days = items
      .filter((i): i is typeof i & { local: string } => i.local !== null)
      .map((i) =>
        DateTime.fromISO(i.local, { zone: BERLIN }).toFormat('yyyy-LL-dd')
      );
    expect(days).not.toContain('2025-03-29');
  });

  it('applies completed override (suppression)', () => {
    const cfg = parseRule('FREQ=DAILY;INTERVAL=1', '2025-03-28T07:00:00Z');
    const range = {
      start: DateTime.fromISO('2025-03-28T00:00:00', {
        zone: BERLIN,
      }).toJSDate(),
      end: DateTime.fromISO('2025-03-30T23:59:59', {
        zone: BERLIN,
      }).toJSDate(),
      timezone: BERLIN,
    };
    const overrides = [
      {
        id: 'o1',
        seriesId: 's',
        occurrenceLocalDate: '2025-03-29',
        status: 'completed',
      } as any,
    ];
    const items = collect(buildIterator({ config: cfg, overrides, range }));
    const days = items
      .filter((i): i is typeof i & { local: string } => i.local !== null)
      .map((i) =>
        DateTime.fromISO(i.local, { zone: BERLIN }).toFormat('yyyy-LL-dd')
      );
    expect(days).not.toContain('2025-03-29');
  });

  it('applies reschedule override', () => {
    const cfg = parseRule('FREQ=DAILY;INTERVAL=1', '2025-03-28T07:00:00Z');
    const range = {
      start: DateTime.fromISO('2025-03-28T00:00:00', {
        zone: BERLIN,
      }).toJSDate(),
      end: DateTime.fromISO('2025-03-30T23:59:59', {
        zone: BERLIN,
      }).toJSDate(),
      timezone: BERLIN,
    };
    const overrides = [
      {
        id: 'o1',
        seriesId: 's',
        occurrenceLocalDate: '2025-03-29',
        status: 'reschedule',
        dueAtLocal: '2025-03-29T10:00:00+01:00',
        dueAtUtc: '2025-03-29T09:00:00Z',
      } as any,
    ];
    const items = collect(buildIterator({ config: cfg, overrides, range }));
    const targetLocal = items.find(
      (i) =>
        DateTime.fromISO(i.local, { zone: BERLIN }).toFormat('yyyy-LL-dd') ===
        '2025-03-29'
    );
    expect(targetLocal).toBeTruthy();
    if (targetLocal) {
      const dt = DateTime.fromISO(targetLocal.local, { zone: BERLIN });
      expect(dt.hour).toBe(10);
    }
  });
});
