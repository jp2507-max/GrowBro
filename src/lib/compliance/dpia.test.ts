import { type DPIAConfig, validateDPIAConfig } from '@/lib/compliance/dpia';

describe('DPIA validation', () => {
  const base: DPIAConfig = {
    version: '1.0.0',
    aiModelVersion: 'v123',
    completedAt: new Date().toISOString(),
    signedOff: true,
    mitigations: [],
  };

  test('passes when signed off and versions match', () => {
    expect(() => validateDPIAConfig({ ...base }, 'v123')).not.toThrow();
  });

  test('fails when not signed off', () => {
    expect(() =>
      validateDPIAConfig({ ...base, signedOff: false }, 'v123')
    ).toThrow(/not signed off/i);
  });

  test('fails when model version mismatches', () => {
    expect(() => validateDPIAConfig({ ...base }, 'v124')).toThrow(
      /version change/i
    );
  });
});
