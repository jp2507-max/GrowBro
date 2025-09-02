import { classifyTaskCategory, onTaskCompleted } from '@/lib/plant-telemetry';

// Mock supabase client used in telemetry module
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null }),
  },
}));

describe('plant-telemetry', () => {
  test('classifyTaskCategory detects watering', () => {
    expect(
      classifyTaskCategory({
        title: 'Daily watering',
        description: 'Water plants at 8am',
        metadata: {},
      } as any)
    ).toBe('water');
  });

  test('classifyTaskCategory detects feeding', () => {
    expect(
      classifyTaskCategory({
        title: 'Weekly feeding',
        description: 'Nutrients A+B',
        metadata: {},
      } as any)
    ).toBe('feed');
  });

  test('onTaskCompleted is non-blocking and validates plant id', async () => {
    // Invalid plant id, should noop without throwing
    await expect(
      onTaskCompleted({
        id: 't1',
        title: 'watering',
        description: 'water plants',
        plantId: 'not-a-uuid',
        metadata: {},
      } as any)
    ).resolves.toBeUndefined();
  });
});
