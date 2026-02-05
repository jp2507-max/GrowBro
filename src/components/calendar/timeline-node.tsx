import * as React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check, Droplet, Feeding, Flush, Leaf } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

import type { TaskType } from './calendar-list-items';

type TimelineNodeState = 'completed' | 'active' | 'pending' | 'future';

type TimelineNodeProps = {
  state: TimelineNodeState;
  taskType?: TaskType;
  isFirst?: boolean;
  isLast?: boolean;
  testID?: string;
};

const ICON_SIZE = 18;
const NODE_SIZE = 40;

function getIconForTaskType(
  taskType: TaskType | undefined,
  iconColor: string
): React.ReactElement {
  switch (taskType) {
    case 'watering':
      return <Droplet width={ICON_SIZE} height={ICON_SIZE} color={iconColor} />;
    case 'feeding':
      return <Feeding width={ICON_SIZE} height={ICON_SIZE} color={iconColor} />;
    case 'flush':
      return <Flush width={ICON_SIZE} height={ICON_SIZE} color={iconColor} />;
    default:
      return <Leaf width={ICON_SIZE} height={ICON_SIZE} color={iconColor} />;
  }
}

function getNodeColors(state: TimelineNodeState): {
  borderColor: string;
  bgColor: string;
  iconColor: string;
  lineColor: string;
} {
  switch (state) {
    case 'completed':
      return {
        borderColor: colors.neon.lime,
        bgColor: colors.neon.lime,
        iconColor: colors.charcoal[950],
        lineColor: colors.neon.lime,
      };
    case 'active':
      return {
        borderColor: colors.neon.lime,
        bgColor: 'transparent',
        iconColor: colors.neon.lime,
        lineColor: colors.neon.teal,
      };
    case 'pending':
      return {
        borderColor: colors.white,
        bgColor: 'transparent',
        iconColor: colors.white,
        lineColor: `${colors.white}33`, // 20% opacity
      };
    case 'future':
    default:
      return {
        borderColor: `${colors.white}40`, // 25% opacity
        bgColor: 'transparent',
        iconColor: `${colors.white}40`,
        lineColor: `${colors.white}20`, // 12% opacity
      };
  }
}

/**
 * Timeline node with icon and connecting line
 * Part of the vertical timeline in calendar view
 */
export function TimelineNode({
  state,
  taskType,
  isFirst = false,
  isLast = false,
  testID = 'timeline-node',
}: TimelineNodeProps): React.ReactElement {
  const nodeColors = getNodeColors(state);
  const glowOpacity = useSharedValue(state === 'active' ? 0.6 : 0);

  // Pulsing glow animation for active state
  React.useEffect(() => {
    if (state === 'active') {
      glowOpacity.set(
        withRepeat(
          withSequence(
            withTiming(0.8, {
              duration: 1000,
              reduceMotion: ReduceMotion.System,
            }),
            withTiming(0.4, {
              duration: 1000,
              reduceMotion: ReduceMotion.System,
            })
          ),
          -1,
          true
        )
      );
    } else {
      glowOpacity.set(
        withTiming(0, { duration: 200, reduceMotion: ReduceMotion.System })
      );
    }
  }, [state, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const isCompleted = state === 'completed';

  return (
    <View className="items-center" testID={testID}>
      {/* Top connecting line */}
      {!isFirst && (
        <View
          className="h-4 w-0.5"
          style={{ backgroundColor: nodeColors.lineColor }}
        />
      )}

      {/* Node circle with glow */}
      <View style={styles.nodeContainer}>
        {/* Glow layer */}
        {state === 'active' && (
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: colors.neon.lime },
              glowStyle,
            ]}
          />
        )}

        {/* Node circle */}
        <View
          className={cn(
            'items-center justify-center rounded-full',
            state === 'future' && 'border-dashed'
          )}
          style={[
            styles.nodeCircle,
            state === 'completed'
              ? styles.completedCircle
              : state === 'future'
                ? styles.futureCircle
                : styles.defaultCircle,
            {
              borderColor: nodeColors.borderColor,
              backgroundColor: nodeColors.bgColor,
            },
          ]}
        >
          {isCompleted ? (
            <Check
              width={ICON_SIZE}
              height={ICON_SIZE}
              color={nodeColors.iconColor}
            />
          ) : (
            getIconForTaskType(taskType, nodeColors.iconColor)
          )}
        </View>
      </View>

      {/* Bottom connecting line */}
      {!isLast && (
        <View
          className="min-h-[40px] w-0.5 flex-1"
          style={{ backgroundColor: nodeColors.lineColor }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nodeContainer: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
  },
  completedCircle: {
    borderWidth: 0,
    borderStyle: 'solid',
  },
  futureCircle: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  defaultCircle: {
    borderWidth: 2,
    borderStyle: 'solid',
  },
  glow: {
    position: 'absolute',
    width: NODE_SIZE + 16,
    height: NODE_SIZE + 16,
    borderRadius: (NODE_SIZE + 16) / 2,
  },
});
