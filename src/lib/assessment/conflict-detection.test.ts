import { cleanup } from '@/lib/test-utils';

import { detectConflicts, isEqual } from './conflict-detection';

afterEach(cleanup);

describe('conflict-detection', () => {
  describe('isEqual', () => {
    describe('primitive types', () => {
      test('returns true for identical primitives', () => {
        expect(isEqual(42, 42)).toBe(true);
        expect(isEqual('hello', 'hello')).toBe(true);
        expect(isEqual(true, true)).toBe(true);
        expect(isEqual(null, null)).toBe(true);
        expect(isEqual(undefined, undefined)).toBe(true);
      });

      test('returns false for different primitives', () => {
        expect(isEqual(42, 43)).toBe(false);
        expect(isEqual('hello', 'world')).toBe(false);
        expect(isEqual(true, false)).toBe(false);
        expect(isEqual(42, '42')).toBe(false);
      });
    });

    describe('arrays', () => {
      test('returns true for identical arrays', () => {
        expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(isEqual(['a', 'b'], ['a', 'b'])).toBe(true);
        expect(isEqual([], [])).toBe(true);
      });

      test('returns false for arrays with different lengths', () => {
        expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
        expect(isEqual([1, 2, 3], [1, 2])).toBe(false);
      });

      test('returns false for arrays with different values', () => {
        expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false);
        expect(isEqual(['a', 'b'], ['a', 'c'])).toBe(false);
      });

      test('returns false when comparing array with plain object', () => {
        expect(isEqual([1, 2, 3], { 0: 1, 1: 2, 2: 3 })).toBe(false);
        expect(isEqual(['a', 'b'], { 0: 'a', 1: 'b' })).toBe(false);
        expect(isEqual([], {})).toBe(false);
      });

      test('returns false when comparing plain object with array', () => {
        expect(isEqual({ 0: 1, 1: 2, 2: 3 }, [1, 2, 3])).toBe(false);
        expect(isEqual({ 0: 'a', 1: 'b' }, ['a', 'b'])).toBe(false);
        expect(isEqual({}, [])).toBe(false);
      });

      test('handles nested arrays correctly', () => {
        expect(
          isEqual(
            [
              [1, 2],
              [3, 4],
            ],
            [
              [1, 2],
              [3, 4],
            ]
          )
        ).toBe(true);
        expect(
          isEqual(
            [
              [1, 2],
              [3, 4],
            ],
            [
              [1, 2],
              [3, 5],
            ]
          )
        ).toBe(false);
      });
    });

    describe('objects', () => {
      test('returns true for identical objects', () => {
        expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        expect(
          isEqual({ name: 'John', age: 30 }, { name: 'John', age: 30 })
        ).toBe(true);
        expect(isEqual({}, {})).toBe(true);
      });

      test('returns false for objects with different keys', () => {
        expect(isEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
        expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      });

      test('returns false for objects with different values', () => {
        expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
        expect(
          isEqual({ name: 'John', age: 30 }, { name: 'Jane', age: 30 })
        ).toBe(false);
      });

      test('handles nested objects correctly', () => {
        expect(
          isEqual(
            { user: { name: 'John', age: 30 }, active: true },
            { user: { name: 'John', age: 30 }, active: true }
          )
        ).toBe(true);

        expect(
          isEqual(
            { user: { name: 'John', age: 30 }, active: true },
            { user: { name: 'Jane', age: 30 }, active: true }
          )
        ).toBe(false);
      });
    });

    describe('mixed types', () => {
      test('returns false for array vs object with numeric keys', () => {
        // This is the specific bug we're fixing
        expect(isEqual(['a', 'b'], { 0: 'a', 1: 'b' })).toBe(false);
        expect(isEqual([1, 2, 3], { 0: 1, 1: 2, 2: 3 })).toBe(false);
      });

      test('returns false for array vs other types', () => {
        expect(isEqual([1, 2, 3], 'array')).toBe(false);
        expect(isEqual([1, 2, 3], 123)).toBe(false);
        expect(isEqual([1, 2, 3], true)).toBe(false);
        expect(isEqual([1, 2, 3], null)).toBe(false);
        expect(isEqual([1, 2, 3], undefined)).toBe(false);
      });

      test('returns false for object vs other types', () => {
        expect(isEqual({ a: 1 }, 'object')).toBe(false);
        expect(isEqual({ a: 1 }, 123)).toBe(false);
        expect(isEqual({ a: 1 }, true)).toBe(false);
        expect(isEqual({ a: 1 }, null)).toBe(false);
        expect(isEqual({ a: 1 }, undefined)).toBe(false);
      });
    });
  });

  describe('detectConflicts', () => {
    test('returns empty array when data is identical', () => {
      const localData = { name: 'John', age: 30, tags: ['developer', 'react'] };
      const serverData = {
        name: 'John',
        age: 30,
        tags: ['developer', 'react'],
      };
      expect(detectConflicts(localData, serverData)).toEqual([]);
    });

    test('detects conflicts in different fields', () => {
      const localData = { name: 'John', age: 30, tags: ['developer', 'react'] };
      const serverData = { name: 'Jane', age: 25, tags: ['designer', 'vue'] };
      expect(detectConflicts(localData, serverData)).toEqual([
        'name',
        'age',
        'tags',
      ]);
    });

    test('ignores timestamp fields', () => {
      const localData = {
        name: 'John',
        updatedAt: '2023-01-01',
        created_at: '2023-01-01',
      };
      const serverData = {
        name: 'John',
        updatedAt: '2023-01-02',
        created_at: '2023-01-02',
      };
      expect(detectConflicts(localData, serverData)).toEqual([]);
    });

    test('detects array vs object conflicts', () => {
      const localData = { tags: ['developer', 'react'] };
      const serverData = { tags: ['developer', 'typescript'] };
      expect(detectConflicts(localData, serverData)).toEqual(['tags']);
    });

    test('handles missing fields', () => {
      const localData = { name: 'John', age: 30 };
      const serverData = { name: 'John' };
      expect(detectConflicts(localData, serverData)).toEqual(['age']);
    });

    test('handles nested conflicts', () => {
      const localData = { user: { name: 'John', age: 30 }, active: true };
      const serverData = { user: { name: 'Jane', age: 30 }, active: true };
      expect(detectConflicts(localData, serverData)).toEqual(['user']);
    });
  });
});
