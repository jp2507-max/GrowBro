/**
 * Unit tests for normalizeStrain utility - ID generation
 */

import { generateId } from './normalization';

describe('generateId', () => {
  test('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toMatch(/^strain_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^strain_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });
});
