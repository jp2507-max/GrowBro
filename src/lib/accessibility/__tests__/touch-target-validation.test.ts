/**
 * Accessibility Touch Target Validation Tests
 * Tests minimum touch target sizes (44pt iOS / 48dp Android)
 */

import { Platform } from 'react-native';

import { MIN_TOUCH_TARGET_SIZE } from '../constants';
import { validateTouchTarget } from '../touch-target';

describe('Touch Target Validation', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  describe('Platform-specific minimum sizes', () => {
    it('should use 44pt minimum for iOS', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });

      expect(MIN_TOUCH_TARGET_SIZE).toBe(44);
    });

    it('should use 48dp minimum for Android', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });

      expect(MIN_TOUCH_TARGET_SIZE).toBe(48);
    });
  });

  describe('validateTouchTarget', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
    });

    it('should pass for valid touch target', () => {
      const result = validateTouchTarget({
        width: 44,
        height: 44,
      });

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should pass for larger touch target', () => {
      const result = validateTouchTarget({
        width: 100,
        height: 60,
      });

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail for width below minimum', () => {
      const result = validateTouchTarget({
        width: 40,
        height: 44,
      });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Width');
      expect(result.violations[0]).toContain('40');
      expect(result.violations[0]).toContain('44');
    });

    it('should fail for height below minimum', () => {
      const result = validateTouchTarget({
        width: 44,
        height: 40,
      });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Height');
      expect(result.violations[0]).toContain('40');
      expect(result.violations[0]).toContain('44');
    });

    it('should fail for both dimensions below minimum', () => {
      const result = validateTouchTarget({
        width: 32,
        height: 32,
      });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('Playbook-specific components', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
    });

    it('should validate playbook selection cards', () => {
      const result = validateTouchTarget({
        width: 160,
        height: 200,
      });
      expect(result.isValid).toBe(true);
    });

    it('should validate task list items', () => {
      const result = validateTouchTarget({
        width: 350,
        height: 60,
      });
      expect(result.isValid).toBe(true);
    });

    it('should validate schedule shift buttons', () => {
      const result = validateTouchTarget({
        width: 120,
        height: 44,
      });
      expect(result.isValid).toBe(true);
    });

    it('should validate task checkbox', () => {
      const result = validateTouchTarget({
        width: 44,
        height: 44,
      });
      expect(result.isValid).toBe(true);
    });

    it('should fail for too-small icons', () => {
      const result = validateTouchTarget({
        width: 24,
        height: 24,
      });
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('Platform-specific validation', () => {
    it('should validate against iOS guidelines', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });

      const result = validateTouchTarget({
        width: 44,
        height: 44,
      });
      expect(result.isValid).toBe(true);
      expect(result.minRequired).toBe(44);
    });

    it('should validate against Android guidelines', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });

      const result = validateTouchTarget({
        width: 48,
        height: 48,
      });
      expect(result.isValid).toBe(true);
      expect(result.minRequired).toBe(48);
    });

    it('should reject Android target below 48dp', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });

      const result = validateTouchTarget({
        width: 44,
        height: 44,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
    });

    it('should handle zero dimensions', () => {
      const result = validateTouchTarget({
        width: 0,
        height: 0,
      });
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
    });

    it('should handle negative dimensions', () => {
      const result = validateTouchTarget({
        width: -10,
        height: -10,
      });
      expect(result.isValid).toBe(false);
    });

    it('should handle very large dimensions', () => {
      const result = validateTouchTarget({
        width: 10000,
        height: 10000,
      });
      expect(result.isValid).toBe(true);
    });

    it('should handle decimal dimensions', () => {
      const result = validateTouchTarget({
        width: 44.5,
        height: 44.5,
      });
      expect(result.isValid).toBe(true);
    });

    it('should handle exact minimum', () => {
      const result = validateTouchTarget({
        width: 44,
        height: 44,
      });
      expect(result.isValid).toBe(true);
    });

    it('should handle one pixel below minimum', () => {
      const result = validateTouchTarget({
        width: 43,
        height: 43,
      });
      expect(result.isValid).toBe(false);
    });
  });
});
