/**
 * Performance monitoring utilities tests
 */

import {
  PERFORMANCE_TRANSACTIONS,
  SENTRY_PERFORMANCE_CONFIG,
} from '../constants';

describe('Performance Constants', () => {
  test('exports standardized transaction names', () => {
    expect(PERFORMANCE_TRANSACTIONS.AGENDA_SCROLL).toBe('agenda.scroll');
    expect(PERFORMANCE_TRANSACTIONS.NAVIGATION_PUSH).toBe('navigation.push');
    expect(PERFORMANCE_TRANSACTIONS.SYNC_PULL).toBe('sync.pull');
    expect(PERFORMANCE_TRANSACTIONS.SYNC_PUSH).toBe('sync.push');
    expect(PERFORMANCE_TRANSACTIONS.AI_INFER).toBe('ai.infer');
    expect(PERFORMANCE_TRANSACTIONS.IMAGE_DECODE).toBe('image.decode');
  });

  test('exports Sentry performance configuration', () => {
    expect(SENTRY_PERFORMANCE_CONFIG.TRACES_SAMPLE_RATE_PRODUCTION).toBe(0.1);
    expect(SENTRY_PERFORMANCE_CONFIG.TRACES_SAMPLE_RATE_DEVELOPMENT).toBe(1.0);
    expect(SENTRY_PERFORMANCE_CONFIG.ENABLE_AUTO_INSTRUMENTATION).toBe(true);
    expect(SENTRY_PERFORMANCE_CONFIG.ENABLE_NAVIGATION_INSTRUMENTATION).toBe(
      true
    );
    expect(SENTRY_PERFORMANCE_CONFIG.ENABLE_APP_START_INSTRUMENTATION).toBe(
      true
    );
    expect(SENTRY_PERFORMANCE_CONFIG.ENABLE_STALL_TRACKING).toBe(true);
  });
});
