/**
 * FlashList Performance Tests
 * Tests FlashList v2 performance with 1k+ items targeting 60 FPS
 */

import { FlashList } from '@shopify/flash-list';
import React from 'react';
import { Text, View } from 'react-native';

import { cleanup, render, screen, waitFor } from '@/lib/test-utils';

afterEach(cleanup);

describe('FlashList Performance Tests', () => {
  const generateTasks = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}`,
      description: `Description for task ${i}`,
      dueAtUtc: new Date(Date.now() + i * 86400000).toISOString(),
      status: i % 3 === 0 ? 'completed' : 'pending',
    }));
  };

  const TaskItem = ({ item }: { item: any }) => (
    <View
      testID={`task-item-${item.id}`}
      className="h-20 border-b border-neutral-200 p-4"
    >
      <Text>{item.title}</Text>
      <Text>{item.description}</Text>
      <Text>{item.status}</Text>
    </View>
  );

  describe('Rendering Performance', () => {
    it('should render 100 items efficiently', async () => {
      const tasks = generateTasks(100);
      const startTime = performance.now();

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="task-list"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 1 second
      expect(renderTime).toBeLessThan(1000);
    });

    it('should render 1000 items efficiently', async () => {
      const tasks = generateTasks(1000);
      const startTime = performance.now();

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="task-list"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 2 seconds even with 1k items
      expect(renderTime).toBeLessThan(2000);
    });

    it('should render 5000 items efficiently', async () => {
      const tasks = generateTasks(5000);
      const startTime = performance.now();

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="task-list"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 5 seconds even with 5k items
      expect(renderTime).toBeLessThan(5000);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with large datasets', async () => {
      const tasks = generateTasks(1000);

      const { unmount } = render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="task-list"
        />
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;

      unmount();

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      await waitFor(() => {
        const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
        // Memory should not increase significantly after unmount
        expect(memoryAfter).toBeLessThanOrEqual(memoryBefore * 1.1);
      });
    });
  });

  describe('Scroll Performance', () => {
    it('should handle rapid data updates', async () => {
      const initialTasks = generateTasks(100);
      const { rerender } = render(
        <FlashList
          data={initialTasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="task-list"
        />
      );

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedTasks = generateTasks(100 + i * 10);
        const startTime = performance.now();

        rerender(
          <FlashList
            data={updatedTasks}
            renderItem={({ item }) => <TaskItem item={item} />}
            testID="task-list"
          />
        );

        const endTime = performance.now();
        const updateTime = endTime - startTime;

        // Each update should be fast
        expect(updateTime).toBeLessThan(100);
      }
    });
  });

  describe('Item Size Estimation', () => {
    it('should work without estimatedItemSize (FlashList v2 auto-sizing)', async () => {
      const tasks = generateTasks(100);

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          // No estimatedItemSize - FlashList v2 should handle this
          testID="task-list"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('task-list')).toBeOnTheScreen();
      });
    });

    it('should handle variable item heights', async () => {
      const tasks = generateTasks(100).map((task, i) => ({
        ...task,
        height: 60 + (i % 3) * 20, // Heights: 60, 80, 100
      }));

      const VariableHeightItem = ({ item }: { item: any }) => (
        <View
          testID={`task-item-${item.id}`}
          className="p-4"
          style={{ height: item.height }}
        >
          <Text>{item.title}</Text>
        </View>
      );

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <VariableHeightItem item={item} />}
          testID="task-list"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('task-list')).toBeOnTheScreen();
      });
    });
  });

  describe('Playbook-specific scenarios', () => {
    it('should handle task timeline with 1000+ tasks', async () => {
      const tasks = generateTasks(1500);
      const startTime = performance.now();

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="playbook-timeline"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(2000);
      await waitFor(() => {
        expect(screen.getByTestId('playbook-timeline')).toBeOnTheScreen();
      });
    });

    it('should handle phase-grouped tasks efficiently', async () => {
      const phases = ['seedling', 'veg', 'flower', 'harvest'];
      const tasksPerPhase = 250;
      const tasks = phases.flatMap((phase, phaseIndex) =>
        generateTasks(tasksPerPhase).map((task, i) => ({
          ...task,
          id: `${phase}-task-${i}`,
          phase,
          phaseIndex,
        }))
      );

      const startTime = performance.now();

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="phase-grouped-list"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(2000);
      expect(tasks).toHaveLength(1000);
    });

    it('should handle filtered task views', async () => {
      const allTasks = generateTasks(1000);
      const completedTasks = allTasks.filter(
        (task) => task.status === 'completed'
      );

      const startTime = performance.now();

      render(
        <FlashList
          data={completedTasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="filtered-list"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Performance Metrics', () => {
    it('should track render count for performance monitoring', async () => {
      let renderCount = 0;

      const TrackedTaskItem = ({ item }: { item: any }) => {
        renderCount++;
        return <TaskItem item={item} />;
      };

      const tasks = generateTasks(100);

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TrackedTaskItem item={item} />}
          testID="tracked-list"
        />
      );

      await waitFor(() => {
        // FlashList should only render visible items + buffer
        // With viewport of ~800px and item height of 80px, should render ~15-20 items
        expect(renderCount).toBeLessThan(30);
      });
    });

    it('should measure frame drops during updates', async () => {
      const tasks = generateTasks(500);
      const { rerender } = render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="frame-test-list"
        />
      );

      const frameDrops: number[] = [];

      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();

        const updatedTasks = tasks.map((task) => ({
          ...task,
          title: `${task.title} - Updated ${i}`,
        }));

        rerender(
          <FlashList
            data={updatedTasks}
            renderItem={({ item }) => <TaskItem item={item} />}
            testID="frame-test-list"
          />
        );

        const endTime = performance.now();
        const frameDuration = endTime - startTime;

        // 60 FPS = 16.67ms per frame
        if (frameDuration > 16.67) {
          frameDrops.push(frameDuration);
        }
      }

      // Should have minimal frame drops (< 20% of updates)
      expect(frameDrops.length).toBeLessThan(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty list', async () => {
      render(
        <FlashList
          data={[]}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="empty-list"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('empty-list')).toBeOnTheScreen();
      });
    });

    it('should handle single item', async () => {
      const tasks = generateTasks(1);

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <TaskItem item={item} />}
          testID="single-item-list"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('task-item-task-0')).toBeOnTheScreen();
      });
    });

    it('should handle very large items', async () => {
      const tasks = generateTasks(100);

      const LargeTaskItem = ({ item }: { item: any }) => (
        <View testID={`task-item-${item.id}`} className="h-[200px] p-4">
          <Text>{item.title}</Text>
          <Text>{item.description}</Text>
          <Text>{item.status}</Text>
        </View>
      );

      render(
        <FlashList
          data={tasks}
          renderItem={({ item }) => <LargeTaskItem item={item} />}
          testID="large-item-list"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('large-item-list')).toBeOnTheScreen();
      });
    });
  });
});
