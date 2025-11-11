# Animations Primitives (GrowBro)

Lightweight, index-driven motion utilities for onboarding and similar flows.

Usage pattern

- Drive a `SharedValue<number>` `activeIndex` from horizontal paging (offsetX / width).
- Use `useAnimatedStyle` and call primitives inside the worklet.
- Keep Tailwind classes static; pass dynamic values via animated styles.

Examples

```tsx
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  indexDrivenTranslateX,
  indexDrivenRotate,
  indexDrivenScale,
  SPRING,
} from '@/lib/animations';

function Card({
  activeIndex,
  center,
}: {
  activeIndex: SharedValue<number>;
  center: number;
}) {
  const rStyle = useAnimatedStyle(() => {
    const tx = indexDrivenTranslateX({
      activeIndex,
      inputRange: [center, center + 1],
      outputRange: [0, -300],
    });
    const rot = indexDrivenRotate({
      activeIndex,
      inputRange: [center, center + 0.5],
      outputRange: [-6, 0],
    });
    const sc = indexDrivenScale({
      activeIndex,
      inputRange: [center, center + 0.5],
      outputRange: [1, 0.98],
      opts: { springConfig: SPRING },
    });
    return {
      transform: [{ translateX: tx }, { rotate: `${rot}deg` }, { scale: sc }],
    };
  });
  return (
    <Animated.View style={rStyle} className="rounded-2xl bg-primary-600" />
  );
}
```

Reduced Motion

Pass `reduceMotion: true` in options to return target values without springing.

CTA gating

Use `ctaGateToLastIndex(activeIndex, lastIndex)` to compute `{ opacity, enabled }` for a final button.
