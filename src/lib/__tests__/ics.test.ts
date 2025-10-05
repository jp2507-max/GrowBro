import { exportIcs, importIcs } from '@/lib/ics';

describe('ICS export/import', () => {
  test('exports tasks to ICS text', () => {
    const ics = exportIcs({
      type: 'tasks',
      items: [
        {
          id: 't1',
          title: 'Water plants',
          description: 'Morning routine',
          dueAtLocal: '2025-03-29T08:00:00+01:00',
          dueAtUtc: '2025-03-29T07:00:00Z',
          timezone: 'Europe/Berlin',
          status: 'pending',
          metadata: {},
          createdAt: '2025-03-01T10:00:00Z',
          updatedAt: '2025-03-01T10:00:00Z',
        } as any,
      ],
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Water plants');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  test('imports VEVENT as task with duplicate detection', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VEVENT',
      'UID:abc@test',
      'SUMMARY:Water plants',
      'DTSTART;TZID=Europe/Berlin:20250329T080000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const res = importIcs(ics, {
      timezoneFallback: 'Europe/Berlin',
      existingTasks: [
        {
          id: 'x',
          title: 'Water plants',
          dueAtLocal: '2025-03-29T09:00:00+02:00', // same local day
        },
      ],
    });

    expect(res.tasks.length + res.series.length).toBe(0);
    expect(res.duplicates.length).toBe(1);
  });

  test('robustly parses folded lines and multiline properties', () => {
    // Test with folded lines (DESCRIPTION property split across lines)
    const icsWithFoldedLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VEVENT',
      'UID:folded@test',
      'SUMMARY:Fertilize plants',
      'DESCRIPTION:This is a long description that gets folded ',
      ' onto multiple lines according to RFC 5545',
      'DTSTART;TZID=Europe/Berlin:20250330T090000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:simple@test',
      'SUMMARY:Trim leaves',
      'DTSTART;TZID=Europe/Berlin:20250331T100000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const res = importIcs(icsWithFoldedLines, {
      timezoneFallback: 'Europe/Berlin',
    });

    expect(res.tasks.length).toBe(2);
    expect(res.series.length).toBe(0);
    expect(res.duplicates.length).toBe(0);

    // Check that folded description was properly unfolded
    const fertilizeTask = res.tasks.find((t) => t.title === 'Fertilize plants');
    expect(fertilizeTask).toBeDefined();
    expect(fertilizeTask?.description).toBe(
      'This is a long description that gets folded onto multiple lines according to RFC 5545'
    );

    // Check simple event was also parsed
    const trimTask = res.tasks.find((t) => t.title === 'Trim leaves');
    expect(trimTask).toBeDefined();
    expect(trimTask?.description).toBeUndefined();
  });
});
