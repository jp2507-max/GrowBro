/**
 * Mock for expo-location
 */

export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
} as const;

export type PermissionStatusType =
  (typeof PermissionStatus)[keyof typeof PermissionStatus];

export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
} as const;

export type AccuracyType = (typeof Accuracy)[keyof typeof Accuracy];

export const requestForegroundPermissionsAsync = jest.fn();
export const getForegroundPermissionsAsync = jest.fn();
export const getCurrentPositionAsync = jest.fn();
export const reverseGeocodeAsync = jest.fn();
export const watchPositionAsync = jest.fn();
export const getLastKnownPositionAsync = jest.fn();
