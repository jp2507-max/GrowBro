/**
 * React Native Performance integration utilities
 * Provides TTI/TTFD measurement and render pass reporting
 */

import { PerformanceMeasureView } from '@shopify/react-native-performance';
import React from 'react';
import { Platform } from 'react-native';

import type { RNPerformanceReport } from './types';

/**
 * Track screen time-to-interactive (TTI) and time-to-first-display (TTFD)
 * Wrap your screen component with this to automatically measure performance
 *
 * @example
 * export default function MyScreen() {
 *   return (
 *     <PerformanceTracker screenName="MyScreen">
 *       <View>...</View>
 *     </PerformanceTracker>
 *   );
 * }
 */
export function PerformanceTracker({
  screenName,
  children,
  onReportPrepared,
}: {
  screenName: string;
  children: React.ReactNode;
  onReportPrepared?: (report: Partial<RNPerformanceReport>) => void;
}): React.ReactElement {
  const handleReportPrepared = React.useCallback(
    (report: any) => {
      const performanceReport: Partial<RNPerformanceReport> = {
        screenName,
        timeToInteractive: report.timeToInteractive,
        timeToFirstDisplay: report.timeToFirstDisplay,
        renderPassCount: report.renderPassCount,
      };

      // Log performance metrics in development
      if (__DEV__) {
        console.log(
          `[Performance] ${screenName} - TTI: ${report.timeToInteractive}ms, TTFD: ${report.timeToFirstDisplay}ms`
        );
      }

      onReportPrepared?.(performanceReport);
    },
    [screenName, onReportPrepared]
  );

  return React.createElement(
    PerformanceMeasureView as any,
    {
      screenName,
      onReportPrepared: handleReportPrepared,
      interactive: true,
    },
    children
  );
}

/**
 * Performance marker for custom measurements
 * Use this to mark specific points in your code for performance tracking
 */
export class PerformanceMarker {
  private static marks: Map<string, number> = new Map();

  /**
   * Mark the start of a performance measurement
   */
  static start(name: string): void {
    this.marks.set(name, Date.now());
  }

  /**
   * Mark the end of a performance measurement and return the duration
   */
  static end(name: string): number | null {
    const startTime = this.marks.get(name);
    if (!startTime) {
      if (__DEV__) {
        console.warn(
          `[Performance] No start mark found for "${name}". Call PerformanceMarker.start("${name}") first.`
        );
      }
      return null;
    }

    const duration = Date.now() - startTime;
    this.marks.delete(name);

    if (__DEV__) {
      console.log(`[Performance] ${name}: ${duration}ms`);
    }

    return duration;
  }

  /**
   * Clear all performance marks
   */
  static clear(): void {
    this.marks.clear();
  }

  /**
   * Get duration without clearing the mark
   */
  static getDuration(name: string): number | null {
    const startTime = this.marks.get(name);
    if (!startTime) {
      return null;
    }
    return Date.now() - startTime;
  }
}

/**
 * Hook to measure component render performance
 */
export function useRenderPerformance(componentName: string): void {
  React.useEffect(() => {
    const markName = `${componentName}-mount`;
    PerformanceMarker.start(markName);

    return () => {
      const duration = PerformanceMarker.end(markName);
      if (duration !== null && __DEV__) {
        console.log(`[Performance] ${componentName} mount: ${duration}ms`);
      }
    };
  }, [componentName]);
}

/**
 * Export RN Performance report to JSON for CI artifacts
 */
export function exportPerformanceReport(
  reports: RNPerformanceReport[]
): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      reports,
      metadata: {
        platform: Platform.OS,
        version: Platform.Version,
      },
    },
    null,
    2
  );
}
