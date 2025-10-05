import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { TaskStatus } from '@/types';

import { PhaseTimeline } from './phase-timeline';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _options?: any) => {
      // For testing, return the English translations
      if (key === 'playbooks.overdue') {
        return 'Overdue';
      }
      if (key === 'playbook.noTasks') {
        return 'No tasks found';
      }
      if (key === 'playbook.status.current') {
        return 'Current';
      }
      if (key.startsWith('phases.')) {
        return key.replace('phases.', ''); // Return just the phase name
      }
      return key; // Fallback to return the key itself
    },
  }),
}));

afterEach(cleanup);

// Mock TaskModel instances
const mockTasks: TaskModel[] = [
  {
    id: 'task-1',
    title: 'Water seedlings',
    dueAtLocal: '2024-01-15T10:00:00.000+00:00',
    dueAtUtc: '2024-01-15T10:00:00.000Z',
    timezone: 'UTC',
    status: 'pending' as TaskStatus,
    metadata: {
      phase: 'seedling',
      taskType: 'water',
    },
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    phaseIndex: 0,
  } as unknown as TaskModel,
  {
    id: 'task-2',
    title: 'Check pH levels',
    dueAtLocal: '2024-01-10T10:00:00.000+00:00', // Past date to make it overdue
    dueAtUtc: '2024-01-10T10:00:00.000Z',
    timezone: 'UTC',
    status: 'pending' as TaskStatus,
    metadata: {
      phase: 'seedling',
      taskType: 'monitor',
    },
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    phaseIndex: 0,
  } as unknown as TaskModel,
];

describe('PhaseTimeline', () => {
  beforeAll(() => {
    // Global setup
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<PhaseTimeline tasks={[]} currentPhaseIndex={0} timezone="UTC" />);
      expect(await screen.findByTestId('phase-timeline')).toBeOnTheScreen();
    });

    test('renders timeline items correctly', async () => {
      setup(
        <PhaseTimeline tasks={mockTasks} currentPhaseIndex={0} timezone="UTC" />
      );

      // Check that section header renders
      expect(screen.getByText('Seedling')).toBeOnTheScreen();

      // Check that task titles render
      expect(screen.getByText('Water seedlings')).toBeOnTheScreen();
      expect(screen.getByText('Check pH levels')).toBeOnTheScreen();
    });

    test('renders overdue label for overdue tasks', async () => {
      setup(
        <PhaseTimeline tasks={mockTasks} currentPhaseIndex={0} timezone="UTC" />
      );

      // Check that overdue label is rendered for the overdue task
      expect(screen.getByText('Overdue')).toBeOnTheScreen();
    });

    test('renders empty state when no tasks', async () => {
      setup(<PhaseTimeline tasks={[]} currentPhaseIndex={0} timezone="UTC" />);

      expect(screen.getByText('No tasks found')).toBeOnTheScreen();
    });

    test('renders phase status indicators correctly', async () => {
      setup(
        <PhaseTimeline tasks={mockTasks} currentPhaseIndex={0} timezone="UTC" />
      );

      // Current phase should show "Current"
      expect(screen.getByText('Current')).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('handles task completion toggle', async () => {
      const { user } = setup(
        <PhaseTimeline tasks={mockTasks} currentPhaseIndex={0} timezone="UTC" />
      );

      const checkbox = screen.getAllByRole('checkbox')[0];
      await user.press(checkbox);

      // The checkbox should be checked after interaction
      expect(checkbox).toBeChecked();
    });
  });

  describe('State Management', () => {
    test('updates task completion state correctly', async () => {
      const { user } = setup(
        <PhaseTimeline tasks={mockTasks} currentPhaseIndex={0} timezone="UTC" />
      );

      const checkbox = screen.getAllByRole('checkbox')[0];
      expect(checkbox).not.toBeChecked();

      await user.press(checkbox);
      expect(checkbox).toBeChecked();
    });
  });
});
