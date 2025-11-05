/**
 * Accessibility Testing Utilities
 *
 * Helpers for testing WCAG 2.1 AA compliance:
 * - Minimum touch target size (44pt)
 * - Color contrast ratios
 * - Screen reader labels and hints
 */

import type { ReactTestInstance } from 'react-test-renderer';

/**
 * Minimum touch target size per WCAG 2.1 AA (44x44 points)
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * WCAG 2.1 AA contrast ratios
 */
export const CONTRAST_RATIOS = {
  normalText: 4.5, // Normal text (< 18pt or < 14pt bold)
  largeText: 3, // Large text (>= 18pt or >= 14pt bold)
  uiComponents: 3, // UI components and graphical objects
};

/**
 * Check if a component meets minimum touch target size requirements
 */
export function checkTouchTargetSize(element: ReactTestInstance): {
  passes: boolean;
  width?: number;
  height?: number;
  message: string;
} {
  const style = element.props.style;

  if (!style) {
    return {
      passes: false,
      message: 'No style prop found',
    };
  }

  // Handle array styles (flattened)
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;

  const width = flatStyle.width || flatStyle.minWidth;
  const height = flatStyle.height || flatStyle.minHeight;

  if (!width || !height) {
    return {
      passes: false,
      width,
      height,
      message: 'Could not determine width or height',
    };
  }

  const passes =
    width >= MIN_TOUCH_TARGET_SIZE && height >= MIN_TOUCH_TARGET_SIZE;

  return {
    passes,
    width,
    height,
    message: passes
      ? `Touch target size OK (${width}x${height})`
      : `Touch target too small (${width}x${height}). Minimum: ${MIN_TOUCH_TARGET_SIZE}x${MIN_TOUCH_TARGET_SIZE}`,
  };
}

/**
 * Calculate relative luminance for a color
 * @param rgb - RGB values [r, g, b] in range 0-255
 */
function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((val) => {
    const sRGB = val / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
}

/**
 * Calculate contrast ratio between two colors
 * @param color1 - Hex color string (e.g., "#000000")
 * @param color2 - Hex color string (e.g., "#FFFFFF")
 */
export function calculateContrastRatio(
  color1: string,
  color2: string
): number | null {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return null;
  }

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA requirements
 */
export function checkContrastRatio(
  foreground: string,
  background: string,
  options: {
    isLargeText?: boolean;
    isUIComponent?: boolean;
  } = {}
): {
  passes: boolean;
  ratio: number | null;
  required: number;
  message: string;
} {
  const ratio = calculateContrastRatio(foreground, background);

  if (ratio === null) {
    return {
      passes: false,
      ratio: null,
      required: 0,
      message: 'Could not parse colors',
    };
  }

  const { isLargeText = false, isUIComponent = false } = options;

  const required =
    isLargeText || isUIComponent
      ? CONTRAST_RATIOS.largeText
      : CONTRAST_RATIOS.normalText;

  const passes = ratio >= required;

  return {
    passes,
    ratio,
    required,
    message: passes
      ? `Contrast ratio OK (${ratio.toFixed(2)}:1)`
      : `Insufficient contrast (${ratio.toFixed(2)}:1). Required: ${required}:1`,
  };
}

/**
 * Check if an element has proper accessibility labels
 */
export function checkAccessibilityLabel(element: ReactTestInstance): {
  passes: boolean;
  message: string;
  details: Record<string, unknown>;
} {
  const { accessibilityLabel, accessibilityHint, accessibilityRole, testID } =
    element.props;

  const hasLabel = Boolean(accessibilityLabel);
  const hasRole = Boolean(accessibilityRole);

  const details = {
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole,
    testID,
  };

  if (!hasLabel && !hasRole) {
    return {
      passes: false,
      message: 'Missing both accessibilityLabel and accessibilityRole',
      details,
    };
  }

  if (!hasLabel) {
    return {
      passes: false,
      message:
        'Missing accessibilityLabel (required for screen reader support)',
      details,
    };
  }

  return {
    passes: true,
    message: 'Accessibility label OK',
    details,
  };
}

/**
 * Check if an element has proper screen reader support for its state
 * Useful for toggles, checkboxes, and other stateful components
 */
export function checkScreenReaderState(element: ReactTestInstance): {
  passes: boolean;
  message: string;
  details: Record<string, unknown>;
} {
  const {
    accessibilityState,
    accessibilityValue,
    accessibilityLabel,
    accessibilityRole,
  } = element.props;

  const details = {
    accessibilityState,
    accessibilityValue,
    accessibilityLabel,
    accessibilityRole,
  };

  // Check for interactive roles that should have state
  const interactiveRoles = [
    'button',
    'switch',
    'checkbox',
    'radio',
    'togglebutton',
  ];

  if (accessibilityRole && interactiveRoles.includes(accessibilityRole)) {
    if (!accessibilityState && !accessibilityValue) {
      return {
        passes: false,
        message: `Interactive role "${accessibilityRole}" should have accessibilityState or accessibilityValue`,
        details,
      };
    }
  }

  return {
    passes: true,
    message: 'Screen reader state OK',
    details,
  };
}

/**
 * Check focus order for a group of elements
 * Elements should be in a logical reading order
 */
export function checkFocusOrder(elements: ReactTestInstance[]): {
  passes: boolean;
  message: string;
  order: string[];
} {
  const order = elements.map((el) => {
    return (
      el.props.accessibilityLabel || el.props.testID || el.type || 'unknown'
    );
  });

  // Basic check: ensure no duplicate labels that might confuse screen readers
  const uniqueLabels = new Set(order.filter((label) => label !== 'unknown'));

  if (uniqueLabels.size !== order.filter((o) => o !== 'unknown').length) {
    return {
      passes: false,
      message: 'Duplicate accessibility labels detected',
      order,
    };
  }

  return {
    passes: true,
    message: 'Focus order appears logical',
    order,
  };
}

/**
 * Check if visible focus indicators are present
 */
export function checkFocusIndicator(
  element: ReactTestInstance,
  isFocused: boolean
): { passes: boolean; message: string } {
  if (!isFocused) {
    return {
      passes: true,
      message: 'Element not focused, no indicator required',
    };
  }

  const style = element.props.style;
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;

  // Check for common focus indicator patterns
  const hasBorder = flatStyle.borderWidth || flatStyle.borderColor;
  const hasOutline = flatStyle.outlineWidth || flatStyle.outlineColor;
  const hasShadow = flatStyle.shadowOpacity || flatStyle.elevation;

  if (!hasBorder && !hasOutline && !hasShadow) {
    return {
      passes: false,
      message: 'No visible focus indicator detected',
    };
  }

  return {
    passes: true,
    message: 'Focus indicator present',
  };
}

/**
 * Comprehensive accessibility audit for a component
 */
export function auditAccessibility(
  element: ReactTestInstance,
  options: {
    checkTouchTarget?: boolean;
    checkLabel?: boolean;
    checkState?: boolean;
    isFocused?: boolean;
  } = {}
): {
  passes: boolean;
  results: {
    test: string;
    passes: boolean;
    message: string;
    details?: unknown;
  }[];
} {
  const {
    checkTouchTarget = true,
    checkLabel = true,
    checkState = true,
    isFocused = false,
  } = options;

  const results: {
    test: string;
    passes: boolean;
    message: string;
    details?: unknown;
  }[] = [];

  if (checkTouchTarget) {
    const touchTargetResult = checkTouchTargetSize(element);
    results.push({
      test: 'Touch target size',
      passes: touchTargetResult.passes,
      message: touchTargetResult.message,
      details: {
        width: touchTargetResult.width,
        height: touchTargetResult.height,
      },
    });
  }

  if (checkLabel) {
    const labelResult = checkAccessibilityLabel(element);
    results.push({
      test: 'Accessibility label',
      passes: labelResult.passes,
      message: labelResult.message,
      details: labelResult.details,
    });
  }

  if (checkState) {
    const stateResult = checkScreenReaderState(element);
    results.push({
      test: 'Screen reader state',
      passes: stateResult.passes,
      message: stateResult.message,
      details: stateResult.details,
    });
  }

  if (isFocused) {
    const focusResult = checkFocusIndicator(element, isFocused);
    results.push({
      test: 'Focus indicator',
      passes: focusResult.passes,
      message: focusResult.message,
    });
  }

  const passes = results.every((result) => result.passes);

  return { passes, results };
}
