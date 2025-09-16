import { emitROPAJson, parseROPAAnnotations } from '@/lib/compliance/ropa';

const annotated = `
/**
 * @ropa-purpose telemetry
 * @ropa-lawful-basis consent-6.1.a
 * @ropa-data-categories device-info,usage-patterns
 * @ropa-recipients supabase-eu,internal-analytics
 * @ropa-retention 90-days
 */
export function trackUserAction(action: string) { /* ... */ }
`;

describe('ROPA', () => {
  test('parses annotations into record', () => {
    const rec = parseROPAAnnotations(annotated);
    expect(rec).toEqual(
      expect.objectContaining({
        purpose: 'telemetry',
        lawfulBasis: 'consent-6.1.a',
        retention: '90-days',
      })
    );
    expect(rec?.dataCategories).toEqual(
      expect.arrayContaining(['device-info', 'usage-patterns'])
    );
  });

  test('emits JSON payload', () => {
    const rec = parseROPAAnnotations(annotated)!;
    const json = emitROPAJson([rec]);
    const obj = JSON.parse(json);
    expect(obj.records).toHaveLength(1);
    expect(obj.records[0].purpose).toBe('telemetry');
  });

  test('returns null when incomplete', () => {
    const incomplete = '/** @ropa-purpose telemetry */';
    expect(parseROPAAnnotations(incomplete)).toBeNull();
  });
});
