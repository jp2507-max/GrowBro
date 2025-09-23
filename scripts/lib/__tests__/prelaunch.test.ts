/* eslint-disable @typescript-eslint/no-require-imports */
const { validatePrelaunchReport } = require('../prelaunch');

describe('prelaunch validator', () => {
  test('fails on policy/security warnings and missing crawler/device matrix', () => {
    const res = validatePrelaunchReport({
      warnings: [{ id: 'w1' }],
      policy: { warnings: 1, errors: 0 },
      security: { warnings: 0, errors: 1 },
      crawled: false,
      deviceMatrix: { android13: true },
    });
    expect(res.ok).toBe(false);
    const ruleIds = res.problems.map((p: any) => p.ruleId);
    expect(ruleIds).toEqual(
      expect.arrayContaining([
        'prelaunch:policy-warnings',
        'prelaunch:security-warnings',
        'prelaunch:crawler-failed',
        'prelaunch:device-matrix-missing',
      ])
    );
  });

  test('passes when no warnings, crawler ok, full device matrix', () => {
    const res = validatePrelaunchReport({
      warnings: [],
      policy: { warnings: 0, errors: 0 },
      security: { warnings: 0, errors: 0 },
      crawled: true,
      deviceMatrix: { android13: true, android14: true, android15: true },
    });
    expect(res.ok).toBe(true);
    expect(res.problems).toHaveLength(0);
  });
});
