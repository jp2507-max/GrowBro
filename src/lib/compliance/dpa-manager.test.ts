import {
  getDefaultProcessors,
  toPublicInventory,
  validateProcessors,
} from '@/lib/compliance/dpa-utils';

describe('DPA Manager', () => {
  test('default processors are valid and exportable', () => {
    const list = getDefaultProcessors();
    const result = validateProcessors(list);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);

    const pub = toPublicInventory(list);
    expect(pub).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Supabase', region: 'EU' }),
        expect.objectContaining({ name: 'Sentry', region: 'EU' }),
      ])
    );
  });

  test('flags missing SCC/TIA when region is non-EU', () => {
    const invalid = [
      {
        name: 'SomeVendor',
        purpose: 'telemetry',
        region: 'US' as const,
        dpaLink: 'https://example.com/dpa',
      },
    ];
    const res = validateProcessors(invalid as any);
    expect(res.isValid).toBe(false);
    expect(res.issues.join(',')).toMatch(/missing-scc-tia:SomeVendor/);
  });
});
