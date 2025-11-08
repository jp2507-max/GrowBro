// Test file for worklet rule
/* eslint-disable react-hooks/rules-of-hooks */
import { useAnimatedStyle } from 'react-native-reanimated';

const _TestComponent = () => {
  // This should trigger the rule (console.log in worklet)
  const _animatedStyle = useAnimatedStyle(() => {
    'worklet';
    // eslint-disable-next-line worklet-rules/no-worklet-side-effects
    console.log('This should be flagged'); // Should trigger rule
    return { opacity: 1 };
  });

  // This should NOT trigger the rule (outside worklet)
  console.log('This is fine');

  return null;
};
