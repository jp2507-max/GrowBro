import {
  getMinTouchTargetSize,
  RECOMMENDED_TOUCH_TARGET_SIZE,
} from '../constants';
import {
  calculateRequiredPadding,
  createAccessibleTouchTarget,
  meetsRecommendedSize,
  validateTouchTarget,
} from '../touch-target';

describe('Touch Target Utilities', () => {
  describe('validateTouchTarget', () => {
    test('should validate compliant touch targets', () => {
      const result = validateTouchTarget({ width: 48, height: 48 });

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.minRequired).toBe(getMinTouchTargetSize());
    });

    test('should detect width violations', () => {
      const result = validateTouchTarget({ width: 30, height: 48 });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Width');
      expect(result.violations[0]).toContain('30');
    });

    test('should detect height violations', () => {
      const result = validateTouchTarget({ width: 48, height: 30 });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Height');
      expect(result.violations[0]).toContain('30');
    });

    test('should detect both width and height violations', () => {
      const result = validateTouchTarget({ width: 30, height: 30 });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
    });

    test('should validate exact minimum size', () => {
      const minSize = getMinTouchTargetSize();
      const result = validateTouchTarget({ width: minSize, height: minSize });

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject size just below minimum', () => {
      const minSize = getMinTouchTargetSize();
      const result = validateTouchTarget({
        width: minSize - 1,
        height: minSize - 1,
      });

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('meetsRecommendedSize', () => {
    test('should return true for recommended size', () => {
      const result = meetsRecommendedSize({
        width: RECOMMENDED_TOUCH_TARGET_SIZE,
        height: RECOMMENDED_TOUCH_TARGET_SIZE,
      });

      expect(result).toBe(true);
    });

    test('should return true for sizes above recommended', () => {
      const result = meetsRecommendedSize({
        width: RECOMMENDED_TOUCH_TARGET_SIZE + 10,
        height: RECOMMENDED_TOUCH_TARGET_SIZE + 10,
      });

      expect(result).toBe(true);
    });

    test('should return false for sizes below recommended', () => {
      const result = meetsRecommendedSize({
        width: RECOMMENDED_TOUCH_TARGET_SIZE - 1,
        height: RECOMMENDED_TOUCH_TARGET_SIZE,
      });

      expect(result).toBe(false);
    });

    test('should return false when only one dimension meets recommended', () => {
      const result = meetsRecommendedSize({
        width: RECOMMENDED_TOUCH_TARGET_SIZE,
        height: RECOMMENDED_TOUCH_TARGET_SIZE - 1,
      });

      expect(result).toBe(false);
    });
  });

  describe('calculateRequiredPadding', () => {
    test('should return zero padding for compliant sizes', () => {
      const padding = calculateRequiredPadding({ width: 48, height: 48 });

      expect(padding.horizontal).toBe(0);
      expect(padding.vertical).toBe(0);
    });

    test('should calculate horizontal padding for narrow elements', () => {
      const padding = calculateRequiredPadding({ width: 30, height: 48 });

      expect(padding.horizontal).toBeGreaterThan(0);
      expect(padding.vertical).toBe(0);
    });

    test('should calculate vertical padding for short elements', () => {
      const padding = calculateRequiredPadding({ width: 48, height: 30 });

      expect(padding.horizontal).toBe(0);
      expect(padding.vertical).toBeGreaterThan(0);
    });

    test('should calculate both paddings for small elements', () => {
      const padding = calculateRequiredPadding({ width: 30, height: 30 });

      expect(padding.horizontal).toBeGreaterThan(0);
      expect(padding.vertical).toBeGreaterThan(0);
    });

    test('should calculate correct padding amount', () => {
      const minSize = getMinTouchTargetSize();
      const elementSize = 30;
      const expectedPadding = Math.ceil((minSize - elementSize) / 2);

      const padding = calculateRequiredPadding({
        width: elementSize,
        height: elementSize,
      });

      expect(padding.horizontal).toBe(expectedPadding);
      expect(padding.vertical).toBe(expectedPadding);
    });
  });

  describe('createAccessibleTouchTarget', () => {
    test('should create default accessible touch target', () => {
      const style = createAccessibleTouchTarget();

      expect(style.minWidth).toBe(getMinTouchTargetSize());
      expect(style.minHeight).toBe(getMinTouchTargetSize());
      expect(style.justifyContent).toBe('center');
      expect(style.alignItems).toBe('center');
    });

    test('should create touch target with custom dimensions', () => {
      const style = createAccessibleTouchTarget({ width: 60, height: 60 });

      expect(style.minWidth).toBe(60);
      expect(style.minHeight).toBe(60);
    });

    test('should create touch target with partial custom dimensions', () => {
      const style = createAccessibleTouchTarget({ width: 60 });

      expect(style.minWidth).toBe(60);
      expect(style.minHeight).toBe(getMinTouchTargetSize());
    });

    test('should always include centering styles', () => {
      const style = createAccessibleTouchTarget({ width: 100, height: 100 });

      expect(style.justifyContent).toBe('center');
      expect(style.alignItems).toBe('center');
    });
  });
});
