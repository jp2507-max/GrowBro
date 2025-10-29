/**
 * Mock for @shopify/react-native-performance
 */

import React from 'react';

export const PerformanceMeasureView = ({ children }: any) => {
  return React.createElement('View', {}, children);
};

export const PerformanceMeasure = {
  mark: jest.fn(),
  measure: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
};

export default {
  PerformanceMeasureView,
  PerformanceMeasure,
};
