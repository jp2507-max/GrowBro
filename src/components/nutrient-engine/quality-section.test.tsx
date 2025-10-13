import React from 'react';

import { QualityFlag } from '@/lib/nutrient-engine/types';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { QualitySection } from './quality-section';

afterEach(cleanup);

const mockQualityFlags: QualityFlag[] = [
  QualityFlag.NO_ATC,
  QualityFlag.TEMP_HIGH,
];
const mockConfidence = 0.8;

describe('QualitySection', () => {
  beforeAll(() => {
    // Global setup if needed
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders quality flags when provided', async () => {
      setup(
        <QualitySection
          qualityFlags={mockQualityFlags}
          confidence={mockConfidence}
          testID="test-quality-section"
        />
      );

      expect(
        await screen.findByTestId('test-quality-section-quality')
      ).toBeOnTheScreen();
      expect(
        await screen.findByTestId('test-quality-section-confidence')
      ).toBeOnTheScreen();
    });

    test('does not render quality flags when empty array', async () => {
      setup(
        <QualitySection
          qualityFlags={[]}
          confidence={mockConfidence}
          testID="test-quality-section"
        />
      );

      expect(screen.queryByTestId('test-quality-section-quality')).toBeNull();
      expect(
        await screen.findByTestId('test-quality-section-confidence')
      ).toBeOnTheScreen();
    });

    test('renders with different quality flags', async () => {
      const flagsWithCalStale: QualityFlag[] = [QualityFlag.CAL_STALE];

      setup(
        <QualitySection
          qualityFlags={flagsWithCalStale}
          confidence={mockConfidence}
          testID="test-quality-section"
        />
      );

      expect(
        await screen.findByTestId('test-quality-section-quality')
      ).toBeOnTheScreen();
    });
  });

  describe('Props', () => {
    test('passes correct props to QualityBadge', async () => {
      setup(
        <QualitySection
          qualityFlags={mockQualityFlags}
          confidence={mockConfidence}
          testID="test-quality-section"
        />
      );

      // The component should render without type errors
      expect(
        await screen.findByTestId('test-quality-section-quality')
      ).toBeOnTheScreen();
    });
  });
});
