import { Platform } from 'react-native';

/**
 * Minimum touch target sizes per platform guidelines
 * iOS: 44pt (Human Interface Guidelines)
 * Android: 48dp (Material Design Guidelines)
 */
export const getMinTouchTargetSize = () =>
  Platform.select({
    ios: 44,
    android: 48,
    default: 44,
  });

/**
 * Minimum touch target sizes per platform guidelines
 * iOS: 44pt (Human Interface Guidelines)
 * Android: 48dp (Material Design Guidelines)
 * @deprecated Use getMinTouchTargetSize() instead for runtime platform evaluation
 */
export const MIN_TOUCH_TARGET_SIZE = getMinTouchTargetSize();

/**
 * Recommended touch target size for better accessibility
 */
export const RECOMMENDED_TOUCH_TARGET_SIZE = 48;

/**
 * Minimum spacing between interactive elements
 */
export const MIN_INTERACTIVE_SPACING = 8;

/**
 * Accessibility roles for common interactive elements
 */
export const A11Y_ROLES = {
  BUTTON: 'button',
  LINK: 'link',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  SWITCH: 'switch',
  TAB: 'tab',
  MENU_ITEM: 'menuitem',
  SEARCH: 'search',
  IMAGE: 'image',
  TEXT: 'text',
  HEADER: 'header',
  ADJUSTABLE: 'adjustable',
} as const;

/**
 * Accessibility states
 */
export const A11Y_STATES = {
  DISABLED: 'disabled',
  SELECTED: 'selected',
  CHECKED: 'checked',
  BUSY: 'busy',
  EXPANDED: 'expanded',
} as const;
