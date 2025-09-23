import { describe, expect, test } from '@jest/globals';

import { detectSpam } from './spam-detector';

describe('spam-detector', () => {
  test('deny empty reason', () => {
    expect(detectSpam({ reason: '' })).toBe('deny');
  });
  test('suspicious short reason', () => {
    expect(detectSpam({ reason: 'ok' })).toBe('suspicious');
  });
  test('allow normal reason', () => {
    expect(detectSpam({ reason: 'harassment' })).toBe('allow');
  });
  test('suspicious many repeated chars', () => {
    expect(detectSpam({ reason: 'loooooool' })).toBe('suspicious');
  });
  test('suspicious multiple links short text', () => {
    expect(detectSpam({ reason: 'http://a https://b' })).toBe('suspicious');
  });
});
