import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { DateTime } from 'luxon';
import React from 'react';

import { usePlantAttention } from '@/lib/hooks/use-plant-attention';
import * as taskManager from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

jest.mock('@/lib/task-manager');

const mockGetTasksByDateRange = taskManager.getTasksByDateRange as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = DateTime.local();
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    title: 'Test Task',
    dueAtLocal: now.toISO()!,
    dueAtUtc: now.toUTC().toISO()!,
    timezone: 'UTC',
    status: 'pending',
    metadata: {},
    createdAt: now.toJSDate(),
    updatedAt: now.toJSDate(),
    ...overrides,
  };
}

describe('usePlantAttention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns needsAttention=false when no tasks exist', async () => {
    mockGetTasksByDateRange.mockResolvedValue([]);

    const { result } = renderHook(() => usePlantAttention('plant-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.needsAttention).toBe(false);
    expect(result.current.overdueCount).toBe(0);
    expect(result.current.dueTodayCount).toBe(0);
  });

  test('returns needsAttention=true when plant has overdue tasks', async () => {
    const yesterday = DateTime.local().minus({ days: 1 });
    const overdueTask = createMockTask({
      plantId: 'plant-1',
      dueAtLocal: yesterday.toISO()!,
      status: 'pending',
    });

    mockGetTasksByDateRange.mockResolvedValue([overdueTask]);

    const { result } = renderHook(() => usePlantAttention('plant-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.needsAttention).toBe(true);
    expect(result.current.overdueCount).toBe(1);
    expect(result.current.dueTodayCount).toBe(0);
  });

  test('returns needsAttention=true when plant has tasks due today', async () => {
    const now = DateTime.local();
    const todayTask = createMockTask({
      plantId: 'plant-1',
      dueAtLocal: now.toISO()!,
      status: 'pending',
    });

    mockGetTasksByDateRange.mockResolvedValue([todayTask]);

    const { result } = renderHook(() => usePlantAttention('plant-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.needsAttention).toBe(true);
    expect(result.current.overdueCount).toBe(0);
    expect(result.current.dueTodayCount).toBe(1);
  });

  test('ignores completed tasks', async () => {
    const yesterday = DateTime.local().minus({ days: 1 });
    const completedTask = createMockTask({
      plantId: 'plant-1',
      dueAtLocal: yesterday.toISO()!,
      status: 'completed',
    });

    mockGetTasksByDateRange.mockResolvedValue([completedTask]);

    const { result } = renderHook(() => usePlantAttention('plant-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.needsAttention).toBe(false);
    expect(result.current.overdueCount).toBe(0);
    expect(result.current.dueTodayCount).toBe(0);
  });

  test('filters tasks by plantId', async () => {
    const now = DateTime.local();
    const plant1Task = createMockTask({
      plantId: 'plant-1',
      dueAtLocal: now.toISO()!,
      status: 'pending',
    });
    const plant2Task = createMockTask({
      plantId: 'plant-2',
      dueAtLocal: now.toISO()!,
      status: 'pending',
    });

    mockGetTasksByDateRange.mockResolvedValue([plant1Task, plant2Task]);

    const { result } = renderHook(() => usePlantAttention('plant-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only count plant-1's task
    expect(result.current.dueTodayCount).toBe(1);
  });

  test('does not fetch when disabled', async () => {
    renderHook(() => usePlantAttention('plant-1', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(mockGetTasksByDateRange).not.toHaveBeenCalled();
  });
});
