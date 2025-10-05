import {
  MIN_TOUCH_TARGET_SIZE,
  RECOMMENDED_TOUCH_TARGET_SIZE,
} from './constants';

export interface TouchTargetDimensions {
  width: number;
  height: number;
}

export interface TouchTargetValidation {
  isValid: boolean;
  width: number;
  height: number;
  minRequired: number;
  violations: string[];
}

/**
 * Validates if touch target dimensions meet minimum accessibility requirements
 */
export function validateTouchTarget(
  dimensions: TouchTargetDimensions
): TouchTargetValidation {
  const violations: string[] = [];
  const minRequired = MIN_TOUCH_TARGET_SIZE;

  if (dimensions.width < minRequired) {
    violations.push(
      `Width ${dimensions.width} is below minimum ${minRequired}`
    );
  }

  if (dimensions.height < minRequired) {
    violations.push(
      `Height ${dimensions.height} is below minimum ${minRequired}`
    );
  }

  return {
    isValid: violations.length === 0,
    width: dimensions.width,
    height: dimensions.height,
    minRequired,
    violations,
  };
}

/**
 * Checks if touch target meets recommended size for better accessibility
 */
export function meetsRecommendedSize(
  dimensions: TouchTargetDimensions
): boolean {
  return (
    dimensions.width >= RECOMMENDED_TOUCH_TARGET_SIZE &&
    dimensions.height >= RECOMMENDED_TOUCH_TARGET_SIZE
  );
}

/**
 * Calculates the padding needed to meet minimum touch target size
 */
export function calculateRequiredPadding(dimensions: TouchTargetDimensions): {
  horizontal: number;
  vertical: number;
} {
  const minRequired = MIN_TOUCH_TARGET_SIZE;

  const horizontalPadding = Math.max(
    0,
    Math.ceil((minRequired - dimensions.width) / 2)
  );
  const verticalPadding = Math.max(
    0,
    Math.ceil((minRequired - dimensions.height) / 2)
  );

  return {
    horizontal: horizontalPadding,
    vertical: verticalPadding,
  };
}

/**
 * Creates accessible touch target style props
 */
export function createAccessibleTouchTarget(
  dimensions?: Partial<TouchTargetDimensions>
) {
  const minSize = MIN_TOUCH_TARGET_SIZE;

  return {
    minWidth: dimensions?.width || minSize,
    minHeight: dimensions?.height || minSize,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  };
}
