/**
 * LTTB (Largest-Triangle-Three-Buckets) Downsampling Algorithm
 *
 * Reduces data points while preserving visual shape of the chart.
 * Used for performance optimization on charts with large datasets.
 *
 * Requirements:
 * - 4.2: Performance optimization for charts
 * - 15.2: Downsampling for datasets exceeding threshold
 *
 * Reference: Sveinn Steinarsson (2013), "Downsampling Time Series for Visual Representation"
 */

/**
 * Generic data point interface for downsampling
 */
export interface DownsamplePoint {
  x: number;
  y: number;
}

/**
 * Calculate average point for a range of data
 */
function calculateAveragePoint<T extends DownsamplePoint>(
  data: T[],
  start: number,
  end: number
): { x: number; y: number } {
  const length = Math.min(end, data.length) - start;
  let avgX = 0;
  let avgY = 0;

  for (let j = start; j < Math.min(end, data.length); j++) {
    avgX += data[j].x;
    avgY += data[j].y;
  }

  return {
    x: avgX / length,
    y: avgY / length,
  };
}

/**
 * Find point with largest triangle area
 */
function findLargestTrianglePoint<T extends DownsamplePoint>(
  data: T[],
  options: {
    rangeStart: number;
    rangeEnd: number;
    pointAX: number;
    pointAY: number;
    avgX: number;
    avgY: number;
  }
): number {
  const { rangeStart, rangeEnd, pointAX, pointAY, avgX, avgY } = options;
  let maxArea = -1;
  let maxAreaPoint = rangeStart;

  for (let j = rangeStart; j < Math.min(rangeEnd, data.length); j++) {
    const pointX = data[j].x;
    const pointY = data[j].y;

    // Calculate triangle area using cross product
    const area = Math.abs(
      (pointAX - avgX) * (pointY - pointAY) -
        (pointAX - pointX) * (avgY - pointAY)
    );

    if (area > maxArea) {
      maxArea = area;
      maxAreaPoint = j;
    }
  }

  return maxAreaPoint;
}

/**
 * LTTB downsampling algorithm
 *
 * @param data - Array of data points with x and y coordinates
 * @param threshold - Target number of points (default 365)
 * @returns Downsampled array preserving visual shape
 */
export function lttbDownsample<T extends DownsamplePoint>(
  data: T[],
  threshold: number = 365
): T[] {
  // If data length is less than or equal to threshold, return as is
  if (data.length <= threshold || threshold < 3) {
    return data;
  }

  const sampledData: T[] = [];

  // Always include first point
  sampledData.push(data[0]);

  // Bucket size (excluding first and last points)
  const bucketSize = (data.length - 2) / (threshold - 2);

  // Keep track of selected point index
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate point average for next bucket
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;

    const avg = calculateAveragePoint(data, avgRangeStart, avgRangeEnd);

    // Get the range for this bucket
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    // Find point with largest triangle area
    const maxAreaPoint = findLargestTrianglePoint(data, {
      rangeStart,
      rangeEnd,
      pointAX: data[a].x,
      pointAY: data[a].y,
      avgX: avg.x,
      avgY: avg.y,
    });

    // Pick point with largest area
    sampledData.push(data[maxAreaPoint]);
    a = maxAreaPoint;
  }

  // Always include last point
  sampledData.push(data[data.length - 1]);

  return sampledData;
}

/**
 * Helper to check if downsampling is needed
 *
 * @param dataLength - Number of data points
 * @param threshold - Target number of points
 * @returns True if downsampling should be applied
 */
export function shouldDownsample(
  dataLength: number,
  threshold: number = 365
): boolean {
  return dataLength > threshold && threshold >= 3;
}
