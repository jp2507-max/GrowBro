/**
 * Tests for alkalinity warning utilities
 *
 * Requirements: 8.2, 8.6
 */

import type { SourceWaterProfile } from '../types';
import {
  ALKALINITY_THRESHOLDS,
  getAlkalinityEducationalContent,
  getAlkalinityRiskLevel,
  getAlkalinityTestingGuidance,
  getAlkalinityWarning,
  shouldShowAlkalinityWarning,
} from './alkalinity-warnings';

describe('alkalinity-warnings', () => {
  const createMockProfile = (alkalinity: number): SourceWaterProfile => ({
    id: 'profile-1',
    name: 'Test Profile',
    baselineEc25c: 0.3,
    alkalinityMgPerLCaco3: alkalinity,
    hardnessMgPerL: 150,
    lastTestedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  describe('getAlkalinityRiskLevel', () => {
    it('should classify as low risk when alkalinity < 120 mg/L', () => {
      const profile = createMockProfile(50);
      expect(getAlkalinityRiskLevel(profile)).toBe('low');

      const profileAtThreshold = createMockProfile(119);
      expect(getAlkalinityRiskLevel(profileAtThreshold)).toBe('low');
    });

    it('should classify as moderate risk when alkalinity 120-149 mg/L', () => {
      const profile = createMockProfile(120);
      expect(getAlkalinityRiskLevel(profile)).toBe('moderate');

      const profileMid = createMockProfile(135);
      expect(getAlkalinityRiskLevel(profileMid)).toBe('moderate');

      const profileAtEdge = createMockProfile(149);
      expect(getAlkalinityRiskLevel(profileAtEdge)).toBe('moderate');
    });

    it('should classify as high risk when alkalinity >= 150 mg/L', () => {
      const profile = createMockProfile(150);
      expect(getAlkalinityRiskLevel(profile)).toBe('high');

      const profileVeryHigh = createMockProfile(250);
      expect(getAlkalinityRiskLevel(profileVeryHigh)).toBe('high');
    });
  });

  describe('shouldShowAlkalinityWarning', () => {
    it('should not show warning for low alkalinity (<120 mg/L)', () => {
      const profile = createMockProfile(80);
      expect(shouldShowAlkalinityWarning(profile)).toBe(false);
    });

    it('should show warning for moderate alkalinity (>=120 mg/L)', () => {
      const profile = createMockProfile(120);
      expect(shouldShowAlkalinityWarning(profile)).toBe(true);

      const profileHigh = createMockProfile(135);
      expect(shouldShowAlkalinityWarning(profileHigh)).toBe(true);
    });

    it('should show warning for high alkalinity (>=150 mg/L)', () => {
      const profile = createMockProfile(150);
      expect(shouldShowAlkalinityWarning(profile)).toBe(true);

      const profileVeryHigh = createMockProfile(250);
      expect(shouldShowAlkalinityWarning(profileVeryHigh)).toBe(true);
    });
  });

  describe('getAlkalinityWarning', () => {
    it('should return null for low risk alkalinity', () => {
      const profile = createMockProfile(80);
      const warning = getAlkalinityWarning(profile);

      expect(warning).toBeNull();
    });

    it('should return moderate warning for 120-149 mg/L alkalinity', () => {
      const profile = createMockProfile(135);
      const warning = getAlkalinityWarning(profile);

      expect(warning).not.toBeNull();
      expect(warning?.riskLevel).toBe('moderate');
      expect(warning?.title).toBe('Moderate pH Drift Risk');
      expect(warning?.message).toContain('135 mg/L');
      expect(warning?.educationalGuidance.length).toBeGreaterThan(0);
      expect(warning?.mitigationLink).toContain('alkalinity');
      expect(warning?.showInline).toBe(true);
    });

    it('should return high warning for >=150 mg/L alkalinity', () => {
      const profile = createMockProfile(200);
      const warning = getAlkalinityWarning(profile);

      expect(warning).not.toBeNull();
      expect(warning?.riskLevel).toBe('high');
      expect(warning?.title).toBe('High pH Drift Risk');
      expect(warning?.message).toContain('200 mg/L');
      expect(warning?.educationalGuidance.length).toBeGreaterThan(0);
      expect(warning?.mitigationLink).toContain('high-alkalinity');
      expect(warning?.showInline).toBe(true);
    });

    it('should include educational guidance in warnings (Requirement 8.6)', () => {
      const profileModerate = createMockProfile(130);
      const warningModerate = getAlkalinityWarning(profileModerate);

      expect(
        warningModerate?.educationalGuidance.some((msg) =>
          msg.toLowerCase().includes('ph')
        )
      ).toBe(true);

      const profileHigh = createMockProfile(180);
      const warningHigh = getAlkalinityWarning(profileHigh);

      expect(warningHigh?.educationalGuidance.length).toBeGreaterThanOrEqual(4);
      // Verify educational tone (no product promotion)
      expect(
        warningHigh?.educationalGuidance.some((msg) =>
          msg.toLowerCase().includes('buy')
        )
      ).toBe(false);
      expect(
        warningHigh?.educationalGuidance.some((msg) =>
          msg.toLowerCase().includes('purchase')
        )
      ).toBe(false);
    });
  });

  describe('getAlkalinityEducationalContent', () => {
    it('should return base content for low risk', () => {
      const content = getAlkalinityEducationalContent('low');

      expect(content.length).toBeGreaterThan(2);
      expect(content[0]).toContain('Alkalinity');
      expect(content.some((msg) => msg.includes('manageable range'))).toBe(
        true
      );
    });

    it('should return appropriate content for moderate risk', () => {
      const content = getAlkalinityEducationalContent('moderate');

      expect(content.length).toBeGreaterThan(3);
      expect(content.some((msg) => msg.includes('regular pH monitoring'))).toBe(
        true
      );
      expect(
        content.some((msg) => msg.includes('pH adjustments every few days'))
      ).toBe(true);
    });

    it('should return detailed content for high risk', () => {
      const content = getAlkalinityEducationalContent('high');

      expect(content.length).toBeGreaterThan(4);
      expect(content.some((msg) => msg.includes('active pH management'))).toBe(
        true
      );
      expect(content.some((msg) => msg.includes('Daily pH monitoring'))).toBe(
        true
      );
    });

    it('should not include product promotion (Requirement 8.6)', () => {
      const lowContent = getAlkalinityEducationalContent('low');
      const moderateContent = getAlkalinityEducationalContent('moderate');
      const highContent = getAlkalinityEducationalContent('high');

      const allContent = [...lowContent, ...moderateContent, ...highContent];

      // Check for promotional language
      const promotionalWords = [
        'buy',
        'purchase',
        'order',
        'shop',
        'sale',
        'discount',
      ];
      allContent.forEach((text) => {
        promotionalWords.forEach((word) => {
          expect(text.toLowerCase()).not.toContain(word);
        });
      });
    });
  });

  describe('getAlkalinityTestingGuidance', () => {
    it('should return testing recommendations', () => {
      const guidance = getAlkalinityTestingGuidance();

      expect(guidance.length).toBeGreaterThan(2);
      expect(
        guidance.some((msg) => msg.includes('Test your source water'))
      ).toBe(true);
      expect(guidance.some((msg) => msg.includes('annually'))).toBe(true);
    });

    it('should be phrased as educational guidance (Requirement 8.6)', () => {
      const guidance = getAlkalinityTestingGuidance();

      // Should not include promotional language
      const combinedText = guidance.join(' ').toLowerCase();
      expect(combinedText).not.toContain('buy');
      expect(combinedText).not.toContain('purchase');
      expect(combinedText).not.toContain('shop');
    });
  });

  describe('ALKALINITY_THRESHOLDS', () => {
    it('should define correct threshold values', () => {
      expect(ALKALINITY_THRESHOLDS.LOW_THRESHOLD).toBe(100);
      expect(ALKALINITY_THRESHOLDS.MODERATE_THRESHOLD).toBe(120);
      expect(ALKALINITY_THRESHOLDS.HIGH_THRESHOLD).toBe(150);
    });

    it('should have thresholds in ascending order', () => {
      expect(ALKALINITY_THRESHOLDS.LOW_THRESHOLD).toBeLessThan(
        ALKALINITY_THRESHOLDS.MODERATE_THRESHOLD
      );
      expect(ALKALINITY_THRESHOLDS.MODERATE_THRESHOLD).toBeLessThan(
        ALKALINITY_THRESHOLDS.HIGH_THRESHOLD
      );
    });
  });
});
