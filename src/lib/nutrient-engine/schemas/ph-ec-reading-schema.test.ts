import { safeParsePhEcReadingForm } from './ph-ec-reading-schema';

describe('PhEcReadingSchema', () => {
  describe('Validation Messages', () => {
    test('returns localized error message for missing pH', () => {
      const result = safeParsePhEcReadingForm({
        ecRaw: 1.5,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const phError = result.error.errors.find((err) =>
          err.path.includes('ph')
        );
        expect(phError?.message).toBe('pH is required');
      }
    });

    test('returns localized error message for invalid pH type', () => {
      const result = safeParsePhEcReadingForm({
        ph: 'not-a-number',
        ecRaw: 1.5,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const phError = result.error.errors.find((err) =>
          err.path.includes('ph')
        );
        expect(phError?.message).toBe('pH must be a number');
      }
    });

    test('returns localized error message for pH too low', () => {
      const result = safeParsePhEcReadingForm({
        ph: -1,
        ecRaw: 1.5,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const phError = result.error.errors.find((err) =>
          err.path.includes('ph')
        );
        expect(phError?.message).toBe('pH must be at least 0');
      }
    });

    test('returns localized error message for pH too high', () => {
      const result = safeParsePhEcReadingForm({
        ph: 20,
        ecRaw: 1.5,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const phError = result.error.errors.find((err) =>
          err.path.includes('ph')
        );
        expect(phError?.message).toBe('pH must be at most 14');
      }
    });

    test('returns localized error message for missing EC', () => {
      const result = safeParsePhEcReadingForm({
        ph: 6.5,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const ecError = result.error.errors.find((err) =>
          err.path.includes('ecRaw')
        );
        expect(ecError?.message).toBe('EC is required');
      }
    });

    test('returns localized error message for EC out of range', () => {
      const result = safeParsePhEcReadingForm({
        ph: 6.5,
        ecRaw: 15,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const ecError = result.error.errors.find((err) =>
          err.path.includes('ecRaw')
        );
        expect(ecError?.message).toBe('EC must be at most 10 mS/cm');
      }
    });

    test('valid data passes validation', () => {
      const result = safeParsePhEcReadingForm({
        ph: 6.5,
        ecRaw: 1.5,
        tempC: 25,
        ppmScale: '500' as const,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ph).toBe(6.5);
        expect(result.data.ecRaw).toBe(1.5);
        expect(result.data.tempC).toBe(25);
        expect(result.data.ppmScale).toBe('500');
      }
    });
  });
});
