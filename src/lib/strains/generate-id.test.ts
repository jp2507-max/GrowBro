/**
 * Unit tests for normalizeStrain utility - ID generation
 */

import { generateId } from './normalization';

describe('generateId', () => {
  test('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toMatch(
      /^strain:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(id2).toMatch(
      /^strain:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(id1).not.toBe(id2);
  });
});
