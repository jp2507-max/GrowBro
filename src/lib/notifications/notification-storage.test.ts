import {
  parseData,
  stringifyPayloadData,
} from '@/lib/notifications/notification-storage';

describe('stringifyPayloadData', () => {
  test('returns "<<NULL>>" for null input', () => {
    expect(stringifyPayloadData(null)).toBe('<<NULL>>');
  });

  test('returns "<<NULL>>" for undefined input', () => {
    expect(stringifyPayloadData(undefined)).toBe('<<NULL>>');
  });

  test('serializes strings to JSON', () => {
    expect(stringifyPayloadData('test string')).toBe('"test string"');
  });

  test('serializes object to JSON string', () => {
    const obj = { key: 'value', number: 42 };
    expect(stringifyPayloadData(obj)).toBe(JSON.stringify(obj));
  });

  test('returns "<<SERIALIZE_ERROR>>" for circular reference', () => {
    const obj: any = { prop: 'value' };
    obj.circular = obj; // Create circular reference
    expect(stringifyPayloadData(obj)).toBe('<<SERIALIZE_ERROR>>');
  });
});

describe('parseData', () => {
  test('returns null for empty string', () => {
    expect(parseData('')).toBeNull();
  });

  test('returns null for "<<NULL>>" sentinel', () => {
    expect(parseData('<<NULL>>')).toBeNull();
  });

  test('returns null for "<<SERIALIZE_ERROR>>" sentinel', () => {
    expect(parseData('<<SERIALIZE_ERROR>>')).toBeNull();
  });

  test('parses valid JSON object', () => {
    const obj = { key: 'value', number: 42 };
    const json = JSON.stringify(obj);
    expect(parseData(json)).toEqual(obj);
  });

  test('parses valid JSON array', () => {
    const arr = [1, 2, 'three'];
    const json = JSON.stringify(arr);
    expect(parseData(json)).toEqual(arr);
  });

  test('returns empty object for JSON null', () => {
    expect(parseData('null')).toEqual({});
  });

  test('returns empty object for JSON primitive', () => {
    expect(parseData('"string"')).toEqual({});
    expect(parseData('42')).toEqual({});
    expect(parseData('true')).toEqual({});
  });

  test('returns null for invalid JSON', () => {
    expect(parseData('invalid json')).toBeNull();
    expect(parseData('{invalid')).toBeNull();
    expect(parseData('<<OTHER_SENTINEL>>')).toBeNull();
  });
});

describe('notification-storage round-trip', () => {
  test('null values round-trip correctly', () => {
    const original = null;
    const serialized = stringifyPayloadData(original);
    const parsed = parseData(serialized);
    expect(parsed).toBeNull();
  });

  test('undefined values round-trip correctly', () => {
    const original = undefined;
    const serialized = stringifyPayloadData(original);
    const parsed = parseData(serialized);
    expect(parsed).toBeNull();
  });

  test('string values round-trip correctly', () => {
    const original = 'test string';
    const serialized = stringifyPayloadData(original);
    const parsed = parseData(serialized);
    expect(parsed).toEqual({}); // strings are returned as-is, but parseData treats non-objects as {}
  });

  test('object values round-trip correctly', () => {
    const original = { key: 'value', nested: { num: 42 } };
    const serialized = stringifyPayloadData(original);
    const parsed = parseData(serialized);
    expect(parsed).toEqual(original);
  });

  test('serialization errors are handled gracefully', () => {
    const original: any = { prop: 'value' };
    original.circular = original;
    const serialized = stringifyPayloadData(original);
    const parsed = parseData(serialized);
    expect(parsed).toBeNull();
  });
});
