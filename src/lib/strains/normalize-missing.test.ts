/**
 * Unit tests for normalizeStrain - missing fields
 */

import { DEFAULT_DESCRIPTION, FALLBACK_IMAGE_URL } from './constants';
import { normalizeStrain } from './normalization';

describe('normalizeStrain - missing fields', () => {
  test('generates ID when missing', () => {
    const result = normalizeStrain({});
    expect(result.id).toMatch(/^strain_\d+_[a-z0-9]+$/);
  });

  test('uses default name when missing', () => {
    const result = normalizeStrain({});
    expect(result.name).toBe('Unknown Strain');
  });

  test('uses fallback image URL', () => {
    const result = normalizeStrain({});
    expect(result.imageUrl).toBe(FALLBACK_IMAGE_URL);
  });

  test('uses default description', () => {
    const result = normalizeStrain({});
    expect(result.description).toEqual([DEFAULT_DESCRIPTION]);
  });

  test('normalizes race variants', () => {
    expect(normalizeStrain({ race: 'Indica' }).race).toBe('indica');
    expect(normalizeStrain({ race: 'SATIVA' }).race).toBe('sativa');
    expect(normalizeStrain({ type: 'indica-dominant' }).race).toBe('indica');
  });

  test('defaults difficulty to intermediate', () => {
    const result = normalizeStrain({});
    expect(result.grow.difficulty).toBe('intermediate');
  });

  test('formats with German locale', () => {
    const result = normalizeStrain({ thc: { min: 0.5, max: 1.5 } }, 'de-DE');
    expect(result.thc_display).toBe('0,5-1,5%');
  });
});
