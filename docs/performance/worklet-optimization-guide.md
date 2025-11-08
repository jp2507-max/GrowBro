# Reanimated Worklet Optimization Guide

## Overview

This guide outlines best practices for writing performant Reanimated worklets in GrowBro. Worklets run on the UI thread and must be optimized to maintain 60 FPS performance.

**Performance Target**: P95 input-to-render latency ≤50ms, dropped frames <1%

## Requirements

- **Requirement 2.1**: Babel plugin enabled, all UI-thread functions marked with `'worklet'`, ESLint rules forbid side effects
- **Requirement 2.2**: Worklets must be pure and short-running, no large closures, heavy math deferred to JS thread
- **Requirement 2.3**: Continuous gestures maintain ≤50ms P95 latency, <1% dropped frames
- **Requirement 2.4**: Use `useSharedValue`/`useDerivedValue`, no data races, callback-based completions
- **Requirement 2.5**: Reassure tests lock interaction budgets after fixes

## Babel Configuration

The project uses `react-native-worklets/plugin` which is configured in `babel.config.js`:

```js
plugins: [
  // ... other plugins
  'react-native-worklets/plugin',
];
```

This plugin automatically workletizes callbacks in Reanimated 4.x APIs. Note: This is the correct plugin for this project setup. The standard Reanimated plugin is `react-native-reanimated/plugin`, but we use the worklets plugin for broader compatibility.

## Auto-Workletization in Reanimated 4.x

Reanimated 4.x automatically workletizes callbacks passed to these APIs:

- `useAnimatedStyle`
- `useDerivedValue`
- `useAnimatedScrollHandler` - ✅ Still supported in 4.x
- `useAnimatedReaction`
- `runOnUI`
- **RNGH v2 Gesture handlers**: `Gesture.Pan()`, `Gesture.Tap()`, etc. with `.onStart()`, `.onUpdate()`, `.onEnd()`, `.onFinalize()`
- **Layout animations**: `entering`, `exiting`, `layout` callbacks

**You still need `'worklet'` directive for:**

1. Imported/external functions called from worklets
2. Worklets defined via expressions/ternaries
3. Worklet callbacks inside custom hooks (replace removed `useWorkletCallback` with `useCallback` + `'worklet'`)
4. Top-level reusable worklet utilities

**What Changed in Reanimated 4.x:**

```typescript
// ❌ Removed in 4.x
const callback = useWorkletCallback(() => {
  // worklet code
}, []);

// ✅ Use this instead
const callback = useCallback(() => {
  'worklet';
  // worklet code
}, []);
```

**Modern Gesture API (Reanimated 4.x + RNGH v2):**

```typescript
// ✅ Preferred approach (RNGH v2 with Reanimated 4.x)
const pan = Gesture.Pan()
  .onStart(() => {
    // Auto-workletized
  })
  .onUpdate((e) => {
    // Auto-workletized
    translateX.value = e.translationX;
  })
  .onEnd(() => {
    // Auto-workletized
  });

// ✅ Still valid (useAnimatedScrollHandler)
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => {
    // Auto-workletized
    offsetY.value = event.contentOffset.y;
  },
  onBeginDrag: (event) => {
    // Auto-workletized
    isDragging.value = true;
  },
});
```

## Worklet Best Practices

### ✅ DO: Write Pure, Short-Running Worklets

```typescript
// ✅ Good: Pure worklet with minimal logic
const animatedStyle = useAnimatedStyle(() => {
  return {
    transform: [{ translateX: sharedValue.value }],
    opacity: withTiming(sharedValue.value > 0 ? 1 : 0),
  };
});
```

### ❌ DON'T: Side Effects in Worklets

```typescript
// ❌ Bad: Console logging (ESLint error)
const animatedStyle = useAnimatedStyle(() => {
  console.log('value:', sharedValue.value); // ESLint: worklet-rules/no-worklet-side-effects
  return { opacity: sharedValue.value };
});

// ❌ Bad: Network calls (ESLint error)
const animatedStyle = useAnimatedStyle(() => {
  fetch('/api/data'); // ESLint: worklet-rules/no-worklet-side-effects
  return { opacity: 1 };
});
```

### ✅ DO: Use `runOnJS` for Side Effects (NEVER Per-Frame)

```typescript
// ✅ Good: Schedule side effects on JS thread AFTER gesture
const pan = Gesture.Pan()
  .onUpdate((e) => {
    // Pure UI thread logic only
    translateX.value = e.translationX;
  })
  .onEnd(() => {
    // Use runOnJS for callbacks, analytics, haptics
    // Only called once at the end, NOT per frame
    runOnJS(onGestureComplete)();
  });

// ❌ BAD: runOnJS per frame (kills performance)
const pan = Gesture.Pan().onUpdate((e) => {
  translateX.value = e.translationX;
  runOnJS(logPosition)(e.translationX); // ❌ Called every frame!
});
```

**Critical Rule**: `runOnJS` should **NEVER** be called inside `onUpdate` or any per-frame callback. Use it only for one-time events like `onStart`, `onEnd`, or animation completion callbacks.

### ❌ DON'T: Heavy Computations in Worklets

```typescript
// ❌ Bad: Heavy computation on UI thread
const animatedStyle = useAnimatedStyle(() => {
  // Expensive array operations
  const result = largeArray.map((item) => item * 2).filter((x) => x > 100);
  return { opacity: result.length > 0 ? 1 : 0 };
});

// ✅ Good: Precompute or use runOnJS
const processedValue = useSharedValue(0);

const pan = Gesture.Pan()
  .onUpdate((e) => {
    // Light computation on UI thread
    translateX.value = e.translationX;
  })
  .onEnd(() => {
    // Heavy computation on JS thread
    runOnJS((data) => {
      const result = heavyComputation(data);
      processedValue.value = result;
    })(someData);
  });
```

### ✅ DO: Minimize Closure Captures

```typescript
// ❌ Bad: Capturing large objects
const largeObject = {
  /* ... lots of data ... */
};
const animatedStyle = useAnimatedStyle(() => {
  return { opacity: largeObject.someValue ? 1 : 0 };
});

// ✅ Good: Extract only needed values
const someValue = largeObject.someValue;
const animatedStyle = useAnimatedStyle(() => {
  return { opacity: someValue ? 1 : 0 };
});

// ✅ Better: Use shared values for dynamic data
const someValue = useSharedValue(largeObject.someValue);
const animatedStyle = useAnimatedStyle(() => {
  return { opacity: someValue.value ? 1 : 0 };
});
```

### ✅ DO: Use Shared Values Correctly

```typescript
// ✅ Good: Read .value inside worklets
const animatedStyle = useAnimatedStyle(() => {
  return { opacity: sharedValue.value };
});

// ❌ Bad: Read .value in React render
function MyComponent() {
  const opacity = sharedValue.value; // ❌ Don't do this
  return <View style={{ opacity }} />;
}

// ✅ Good: Derive values inside worklets
const opacity = useDerivedValue(() => {
  return sharedValue.value > 0 ? 1 : 0;
});
```

### ✅ DO: One Write Per Frame

```typescript
// ❌ Bad: Multiple writes in one frame
const pan = Gesture.Pan().onUpdate((e) => {
  translateX.value = e.translationX;
  translateX.value = e.translationX * 2; // Second write in same frame
});

// ✅ Good: Single write per frame
const pan = Gesture.Pan().onUpdate((e) => {
  translateX.value = e.translationX * 2;
});
```

## Performance Monitoring

### Using Gesture Performance Tracker

```typescript
import { useGesturePerformanceTracker } from '@/lib/performance/worklet-monitor';

function MyComponent() {
  const {
    trackGestureStart,
    trackGestureUpdate,
    trackGestureEnd,
    getMetrics,
  } = useGesturePerformanceTracker();

  const pan = Gesture.Pan()
    .onStart(() => {
      trackGestureStart();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      trackGestureUpdate();
    })
    .onEnd(() => {
      trackGestureEnd();

      // Log metrics in development
      if (__DEV__) {
        runOnJS(() => {
          const metrics = getMetrics();
          console.log('Gesture Performance:', {
            avgLatency: metrics.averageLatency.toFixed(2),
            p95Latency: metrics.p95Latency.toFixed(2),
            droppedFrames: metrics.frameDropPercentage.toFixed(2),
          });
        })();
      }
    });

  return <GestureDetector gesture={pan}>{/* ... */}</GestureDetector>;
}
```

### Using Worklet Execution Monitor

```typescript
import {
  measureWorkletStart,
  measureWorkletEnd,
} from '@/lib/performance/worklet-monitor';

const animatedStyle = useAnimatedStyle(() => {
  'worklet';
  const start = measureWorkletStart();

  // Your worklet logic
  const result = {
    transform: [{ translateX: translateX.value }],
  };

  measureWorkletEnd(start, 'myAnimatedStyle');
  return result;
});
```

## ESLint Rules

The project includes custom ESLint rules to enforce worklet best practices:

### `worklet-rules/no-worklet-side-effects`

Automatically detects and prevents:

- `console.log`, `console.warn`, `console.error` in worklets
- `fetch`, `XMLHttpRequest`, `axios` network calls in worklets
- `alert`, `confirm`, `prompt` in worklets

**Configuration** (in `eslint.config.mjs`):

```js
rules: {
  'worklet-rules/no-worklet-side-effects': 'error',
}
```

## Animation Best Practices (Reanimated 4.x)

### Prefer Layout/Shared Transitions Over Manual Animations

```typescript
// ✅ Good: Use layout transitions for size/position changes
import { LinearTransition, ReduceMotion } from 'react-native-reanimated';

<Animated.View
  layout={LinearTransition.reduceMotion(ReduceMotion.System)}
>
  {/* Content that changes size/position */}
</Animated.View>

// ❌ Avoid: Manual width/height animations
const animatedStyle = useAnimatedStyle(() => ({
  width: withTiming(isExpanded.value ? 300 : 100),
  height: withTiming(isExpanded.value ? 200 : 50),
}));
```

### Always Honor Reduced Motion

**Critical**: All animations MUST support system Reduced Motion preferences:

```typescript
import { ReduceMotion, FadeIn, withTiming } from 'react-native-reanimated';

// ✅ Entering/exiting animations
<Animated.View
  entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
  exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
/>

// ✅ Manual animations
opacity.value = withTiming(1, {
  duration: 300,
  reduceMotion: ReduceMotion.System,
});
```

## Common Patterns

### Gesture with Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

const pan = Gesture.Pan()
  .onUpdate((e) => {
    translateX.value = e.translationX;
  })
  .onEnd(() => {
    // Use runOnJS for haptics (NOT in onUpdate)
    runOnJS(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })();
  });
```

### Animation with Callback

```typescript
const animateIn = useCallback(() => {
  opacity.value = withTiming(
    1,
    {
      duration: 300,
      reduceMotion: ReduceMotion.System, // Always include
    },
    (finished) => {
      'worklet';
      if (finished) {
        runOnJS(onAnimationComplete)();
      }
    }
  );
}, [opacity, onAnimationComplete]);
```

### Scroll Handler with Direction Detection

```typescript
const scrollHandler = useAnimatedScrollHandler({
  onBeginDrag: (e) => {
    'worklet';
    isDragging.value = true;
    startOffset.value = e.contentOffset.y;
  },
  onScroll: (e) => {
    'worklet';
    const currentOffset = e.contentOffset.y;
    const delta = currentOffset - startOffset.value;

    if (delta > 0) {
      scrollDirection.value = 'down';
    } else if (delta < 0) {
      scrollDirection.value = 'up';
    }
  },
  onEndDrag: () => {
    'worklet';
    isDragging.value = false;
  },
});
```

## Testing with Reassure

After fixing performance issues, lock the interaction budget with Reassure:

```typescript
import { measurePerformance } from 'reassure';

test('MyComponent gesture performance', async () => {
  await measurePerformance(<MyComponent />, {
    scenario: async ({ getByTestId, user }) => {
      const element = getByTestId('draggable-element');
      await user.press(element);
      await user.drag(element, { x: 100, y: 0 });
    },
  });
});
```

## Performance Checklist

Before merging worklet code, verify:

### Worklet Basics

- [ ] All worklets are marked with `'worklet'` directive (if not auto-workletized)
- [ ] No `console.log` or side effects in worklets
- [ ] Heavy computations use `runOnJS` or are precomputed
- [ ] Shared values use `useSharedValue`/`useDerivedValue`
- [ ] Closures capture minimal data (primitives, not large objects)
- [ ] One write per shared value per frame

### Reanimated 4.x Specific

- [ ] Not using removed `useWorkletCallback` (use `useCallback` + `'worklet'` instead)
- [ ] No `runOnJS` calls inside `onUpdate` or per-frame callbacks
- [ ] All animations include `.reduceMotion(ReduceMotion.System)`
- [ ] Prefer layout/shared transitions over manual width/height animations
- [ ] Using RNGH v2 `Gesture.*()` API for gesture handling (preferred over legacy handlers)

### Code Quality

- [ ] ESLint passes with no `worklet-rules/no-worklet-side-effects` errors
- [ ] No unnecessary `Animated.View` nesting
- [ ] Shared transition tags prefixed by feature (e.g., `feed.card.image`)

### Performance Validation

- [ ] Gesture P95 latency ≤50ms (measured with performance tracker)
- [ ] Dropped frames <1% during continuous gestures
- [ ] Reassure test added for critical interactions
- [ ] Tested with Reduced Motion enabled

## Resources

- [Reanimated 4.x Documentation](https://docs.swmansion.com/react-native-reanimated/)
- [Worklet Best Practices](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/worklets/)
- [Performance Monitoring](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)
- [GrowBro Styling Guidelines](../../styling-guidelines.md)

## Support

For questions or issues with worklet performance:

1. Check this guide and the styling guidelines
2. Review existing worklet patterns in the codebase
3. Use the performance monitoring utilities to identify bottlenecks
4. Consult the Reanimated documentation for advanced patterns
