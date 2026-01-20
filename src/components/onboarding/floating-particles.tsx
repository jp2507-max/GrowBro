/**
 * Floating Particles Background
 * Animated decorative elements for premium onboarding feel
 * Uses Reanimated for smooth 60fps animations
 */

import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  // @ts-ignore - Reanimated 4.x type exports issue
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  // @ts-ignore - Reanimated 4.x type exports issue
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { useReduceMotionEnabled } from '@/lib/strains/accessibility';

type Particle = {
  id: number;
  initialX: number;
  initialY: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

const PARTICLE_COUNT = 5;

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    initialX: Math.random() * 100,
    initialY: Math.random() * 100,
    size: 4 + Math.random() * 8,
    delay: i * 400,
    duration: 4000 + Math.random() * 2000,
    opacity: 0.08 + Math.random() * 0.12,
  }));
}

type FloatingParticleProps = {
  particle: Particle;
  particleColor: string;
  reduceMotion: boolean;
};

function FloatingParticle({
  particle,
  particleColor,
  reduceMotion,
}: FloatingParticleProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(translateY);
      cancelAnimation(translateX);
      translateY.value = 0;
      translateX.value = 0;
      return;
    }

    // Vertical float animation
    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(-30, {
          duration: particle.duration,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true
      )
    );

    // Subtle horizontal drift
    translateX.value = withDelay(
      particle.delay + 200,
      withRepeat(
        withTiming(15, {
          duration: particle.duration * 1.3,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(translateX);
    };
  }, [reduceMotion, translateY, translateX, particle]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        {
          left: `${particle.initialX}%`,
          top: `${particle.initialY}%`,
          width: particle.size,
          height: particle.size,
          opacity: particle.opacity,
          backgroundColor: particleColor,
        },
      ]}
    />
  );
}

export function FloatingParticles(): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const particles = React.useMemo(() => generateParticles(), []);
  const reduceMotion = useReduceMotionEnabled();

  // Theme-aware particle color
  const particleColor = isDark
    ? 'rgba(255, 255, 255, 0.4)' // white for dark mode
    : colors.primary[300]; // soft green for light mode

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      testID="floating-particles"
    >
      {particles.map((particle) => (
        <FloatingParticle
          key={particle.id}
          particle={particle}
          particleColor={particleColor}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    borderRadius: 100,
  },
});
