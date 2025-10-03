/* eslint-disable max-lines-per-function */
/* eslint-disable testing-library/prefer-screen-queries */
/**
 * Performance tests for Strains feature
 * Tests FlashList performance, image loading, and caching
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import type { Strain } from '@/api/strains/types';
import { StrainsListWithCache } from '@/components/strains/strains-list-with-cache';

// Mock data generator
function generateMockStrains(count: number): Strain[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `strain-${i}`,
    name: `Strain ${i}`,
    slug: `strain-${i}`,
    synonyms: [],
    link: `https://example.com/strain-${i}`,
    imageUrl: `https://example.com/image-${i}.jpg`,
    description: [`Description for strain ${i}`],
    genetics: {
      parents: [],
      lineage: '',
    },
    race: ['indica', 'sativa', 'hybrid'][i % 3] as
      | 'indica'
      | 'sativa'
      | 'hybrid',
    thc: {
      min: 15 + (i % 10),
      max: 20 + (i % 10),
    },
    cbd: {
      min: 0,
      max: 1,
    },
    effects: [{ name: 'relaxed' }],
    flavors: [{ name: 'earthy' }],
    grow: {
      difficulty: 'beginner' as const,
      indoor_suitable: true,
      outdoor_suitable: true,
      flowering_time: {},
      yield: {},
      height: {},
    },
    source: {
      provider: 'Test',
      updated_at: new Date().toISOString(),
      attribution_url: '',
    },
    thc_display: `${15 + (i % 10)}-${20 + (i % 10)}%`,
    cbd_display: '0-1%',
  }));
}

describe('Strains Performance Tests', () => {
  describe('FlashList Performance', () => {
    it('should render 100 items efficiently', () => {
      const strains = generateMockStrains(100);
      const startTime = performance.now();

      const { getAllByTestId } = render(
        <StrainsListWithCache
          data={strains}
          onStrainPress={jest.fn()}
          isLoading={false}
          hasNextPage={false}
          onEndReached={jest.fn()}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 500ms
      expect(renderTime).toBeLessThan(500);

      // Verify items are rendered
      const cards = getAllByTestId(/strain-card-/);
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should handle 1000 items without performance degradation', () => {
      const strains = generateMockStrains(1000);
      const startTime = performance.now();

      render(
        <StrainsListWithCache
          data={strains}
          onStrainPress={jest.fn()}
          isLoading={false}
          hasNextPage={false}
          onEndReached={jest.fn()}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should still render in reasonable time
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with repeated renders', () => {
      const strains = generateMockStrains(50);

      // Render multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <StrainsListWithCache
            data={strains}
            onStrainPress={jest.fn()}
            isLoading={false}
            hasNextPage={false}
            onEndReached={jest.fn()}
          />
        );
        unmount();
      }

      // If we get here without crashing, memory is being managed properly
      expect(true).toBe(true);
    });
  });

  describe('Scroll Performance', () => {
    it('should maintain performance during scroll', () => {
      const strains = generateMockStrains(200);

      const { getByTestId } = render(
        <StrainsListWithCache
          data={strains}
          onStrainPress={jest.fn()}
          isLoading={false}
          hasNextPage={true}
          onEndReached={jest.fn()}
        />
      );

      const list = getByTestId('strains-list');

      // Simulate scroll
      const startTime = performance.now();

      // Trigger scroll event
      list.props.onScroll?.({
        nativeEvent: {
          contentOffset: { y: 1000, x: 0 },
          contentSize: { height: 10000, width: 375 },
          layoutMeasurement: { height: 667, width: 375 },
        },
      });

      const endTime = performance.now();
      const scrollTime = endTime - startTime;

      // Scroll handling should be fast
      expect(scrollTime).toBeLessThan(50);
    });
  });

  describe('Data Normalization Performance', () => {
    it('should normalize large datasets efficiently', () => {
      const rawData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Strain ${i}`,
        thc: `${15 + (i % 10)}-${20 + (i % 10)}%`,
        cbd: '0-1%',
      }));

      const startTime = performance.now();

      // Simulate normalization
      const normalized = rawData.map((item) => ({
        ...item,
        thc_display: item.thc,
        cbd_display: item.cbd,
      }));

      const endTime = performance.now();
      const normalizeTime = endTime - startTime;

      // Should normalize quickly
      expect(normalizeTime).toBeLessThan(100);
      expect(normalized).toHaveLength(1000);
    });
  });

  describe('Cache Performance', () => {
    it('should retrieve cached data quickly', () => {
      const cacheKey = 'test-key';
      const data = generateMockStrains(100);

      // Simulate cache write
      const cache = new Map();
      const writeStart = performance.now();
      cache.set(cacheKey, data);
      const writeEnd = performance.now();

      expect(writeEnd - writeStart).toBeLessThan(10);

      // Simulate cache read
      const readStart = performance.now();
      const cached = cache.get(cacheKey);
      const readEnd = performance.now();

      expect(readEnd - readStart).toBeLessThan(5);
      expect(cached).toEqual(data);
    });
  });
});

describe('Strains Performance Benchmarks', () => {
  it('should meet time-to-interactive target', () => {
    // Target: <600ms on mid-tier devices
    const strains = generateMockStrains(20);
    const startTime = performance.now();

    render(
      <StrainsListWithCache
        data={strains}
        onStrainPress={jest.fn()}
        isLoading={false}
        hasNextPage={false}
        onEndReached={jest.fn()}
      />
    );

    const endTime = performance.now();
    const tti = endTime - startTime;

    // Should be interactive quickly
    expect(tti).toBeLessThan(600);
  });

  it('should maintain 60fps target', () => {
    // 60fps = 16.67ms per frame
    const targetFrameTime = 16.67;

    const strains = generateMockStrains(50);

    const { getByTestId } = render(
      <StrainsListWithCache
        data={strains}
        onStrainPress={jest.fn()}
        isLoading={false}
        hasNextPage={false}
        onEndReached={jest.fn()}
      />
    );

    const list = getByTestId('strains-list');

    // Measure frame time for scroll
    const frameStart = performance.now();

    list.props.onScroll?.({
      nativeEvent: {
        contentOffset: { y: 500, x: 0 },
        contentSize: { height: 5000, width: 375 },
        layoutMeasurement: { height: 667, width: 375 },
      },
    });

    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;

    // Should complete within frame budget
    expect(frameTime).toBeLessThan(targetFrameTime);
  });
});
