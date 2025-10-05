/**
 * Tests for accessibility utilities
 */

import {
  formatStrainCardLabel,
  getAccessibilityHint,
  getAccessibleBackgroundColor,
  getAccessibleTextColor,
  getMinTouchTargetSizeStrains,
  getScaledFontSize,
} from '../accessibility';

describe('formatStrainCardLabel', () => {
  it('formats complete strain information', () => {
    const label = formatStrainCardLabel({
      name: 'OG Kush',
      race: 'hybrid',
      thc_display: '18-24%',
      difficulty: 'intermediate',
    });

    expect(label).toContain('OG Kush');
    expect(label).toContain('Hybrid strain');
    expect(label).toContain('THC content: 18-24%');
    expect(label).toContain('Intermediate difficulty');
  });

  it('handles missing THC display', () => {
    const label = formatStrainCardLabel({
      name: 'Test Strain',
      race: 'indica',
      difficulty: 'beginner',
    });

    expect(label).toContain('Test Strain');
    expect(label).toContain('Indica strain');
    expect(label).not.toContain('THC');
    expect(label).toContain('Beginner difficulty');
  });
});

describe('getAccessibilityHint', () => {
  it('returns correct hint for actions', () => {
    expect(getAccessibilityHint('open-detail')).toBe(
      'Double-tap to view strain details'
    );
    expect(getAccessibilityHint('toggle-favorite')).toBe(
      'Double-tap to toggle favorite status'
    );
    expect(getAccessibilityHint('unknown')).toBe('Double-tap to activate');
  });
});

describe('getAccessibleTextColor', () => {
  it('returns high contrast colors when enabled', () => {
    expect(getAccessibleTextColor(true, true)).toBe('#FFFFFF');
    expect(getAccessibleTextColor(false, true)).toBe('#000000');
  });

  it('returns normal colors when high contrast disabled', () => {
    expect(getAccessibleTextColor(true, false)).toBe('#E5E7EB');
    expect(getAccessibleTextColor(false, false)).toBe('#1F2937');
  });
});

describe('getAccessibleBackgroundColor', () => {
  it('returns high contrast backgrounds when enabled', () => {
    expect(getAccessibleBackgroundColor(true, true)).toBe('#000000');
    expect(getAccessibleBackgroundColor(false, true)).toBe('#FFFFFF');
  });

  it('returns normal backgrounds when high contrast disabled', () => {
    expect(getAccessibleBackgroundColor(true, false)).toBe('#171717');
    expect(getAccessibleBackgroundColor(false, false)).toBe('#F9FAFB');
  });
});

describe('getScaledFontSize', () => {
  it('scales font size correctly', () => {
    expect(getScaledFontSize(16, 1.0)).toBe(16);
    expect(getScaledFontSize(16, 1.5)).toBe(24);
    expect(getScaledFontSize(16, 2.0)).toBe(32);
  });

  it('caps scaling at maxScale', () => {
    expect(getScaledFontSize(16, 3.0, 2.0)).toBe(32);
    expect(getScaledFontSize(16, 2.5, 2.0)).toBe(32);
  });
});

describe('getMinTouchTargetSizeStrains', () => {
  it('is defined and reasonable', () => {
    expect(getMinTouchTargetSizeStrains()).toBeGreaterThanOrEqual(44);
    expect(getMinTouchTargetSizeStrains()).toBeLessThanOrEqual(48);
  });
});
