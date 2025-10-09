/**
 * Mock for expo-linear-gradient
 */

import React from 'react';
import { View } from 'react-native';

export const LinearGradient = ({
  children,
  ...props
}: any): React.ReactElement | null =>
  React.createElement(View, props, children);

export default { LinearGradient };
