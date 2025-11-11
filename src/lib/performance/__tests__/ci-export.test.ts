/**
 * CI Export utilities tests
 */

import { Platform } from 'react-native';

import {
  createPerformanceArtifact,
  exportPerformanceMetricsSummary,
  exportPerformanceReportJSON,
} from '../ci-export';
import type { RNPerformanceReport } from '../types';

describe('CI Export Utilities', () => {
  describe('exportPerformanceReportJSON', () => {
    test('exports performance reports as JSON', () => {
      const reports: RNPerformanceReport[] = [
        {
          screenName: 'TestScreen',
          timeToInteractive: 1500,
          timeToFirstDisplay: 800,
          renderPassCount: 3,
          componentRenderTimes: [],
        },
      ];

      const json = exportPerformanceReportJSON(reports);
      const parsed = JSON.parse(json);

      expect(parsed.reports).toEqual(reports);
      expect(parsed.metadata.platform).toBe(Platform.OS);
      expect(parsed.metadata.version).toBe(Platform.Version);
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('createPerformanceArtifact', () => {
    test('creates performance artifact with metadata', () => {
      const artifact = createPerformanceArtifact({
        type: 'perfetto',
        filePath: '/path/to/trace.perfetto',
        metadata: { device: 'Pixel 6a' },
      });

      expect(artifact.type).toBe('perfetto');
      expect(artifact.filePath).toBe('/path/to/trace.perfetto');
      expect(artifact.metadata.device).toBe('Pixel 6a');
      expect(artifact.metadata.platform).toBe(Platform.OS);
      expect(artifact.metadata.timestamp).toBeDefined();
    });

    test('creates artifact with URL', () => {
      const artifact = createPerformanceArtifact({
        type: 'sentry',
        url: 'https://sentry.io/transaction/123',
        metadata: {},
      });

      expect(artifact.type).toBe('sentry');
      expect(artifact.url).toBe('https://sentry.io/transaction/123');
    });
  });

  describe('exportPerformanceMetricsSummary', () => {
    test('exports metrics summary with all data', () => {
      const reports: RNPerformanceReport[] = [
        {
          screenName: 'TestScreen',
          timeToInteractive: 1500,
          componentRenderTimes: [],
        },
      ];

      const summary = exportPerformanceMetricsSummary({
        buildHash: 'abc123',
        device: 'Pixel 6a',
        reports,
        sentryTransactionUrls: ['https://sentry.io/tx/1'],
      });

      const parsed = JSON.parse(summary);

      expect(parsed.buildHash).toBe('abc123');
      expect(parsed.device).toBe('Pixel 6a');
      expect(parsed.reports).toEqual(reports);
      expect(parsed.sentryTransactionUrls).toHaveLength(1);
      expect(parsed.timestamp).toBeDefined();
    });

    test('uses defaults for missing data', () => {
      const summary = exportPerformanceMetricsSummary({
        reports: [],
      });

      const parsed = JSON.parse(summary);

      expect(parsed.buildHash).toBe('unknown');
      expect(parsed.device).toContain(Platform.OS);
      expect(parsed.sentryTransactionUrls).toEqual([]);
    });
  });
});
