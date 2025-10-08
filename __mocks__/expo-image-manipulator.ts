/**
 * Mock for expo-image-manipulator
 */

export enum SaveFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
}

export enum FlipType {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export const manipulateAsync = jest.fn();

export default {
  SaveFormat,
  FlipType,
  manipulateAsync,
};
