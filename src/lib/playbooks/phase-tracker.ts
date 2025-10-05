/**
 * Phase Tracker Service
 *
 * Computes current phase from date windows or task completion,
 * tracks progress, and provides phase summaries.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */

import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import { database } from '@/lib/watermelon';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { GrowPhase, Playbook } from '@/types/playbook';

export type PhaseInfo = {
  currentPhase: GrowPhase;
  phaseIndex: number;
  phaseStartDate: string;
  phaseEndDate: string | null;
  daysInPhase: number;
  estimatedPhaseDuration: number | null;
  progressPercent: number;
};

export type PhaseProgress = {
  phase: GrowPhase;
  phaseIndex: number;
  totalTasks: number;
  completedTasks: number;
  currentTasks: number;
  upcomingTasks: number;
  progressPercent: number;
  startDate: string | null;
  endDate: string | null;
};

export type PhaseSummary = {
  phase: GrowPhase;
  phaseIndex: number;
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  activities: {
    taskType: string;
    count: number;
  }[];
  outcomes: string[];
};

export type ComputePhaseOptions = {
  plantId: string;
  playbookId: string;
  playbook: Playbook;
  plantStartDate: string;
  timezone: string;
};

/**
 * Compute current phase based on date windows and task completion
 */
export async function computeCurrentPhase(
  options: ComputePhaseOptions
): Promise<PhaseInfo> {
  const { plantId, playbookId, playbook, plantStartDate, timezone } = options;
  const now = DateTime.now().setZone(timezone);
  const startDate = DateTime.fromISO(plantStartDate, { zone: timezone });

  // Get all tasks for this plant/playbook
  const tasks = await database
    .get<TaskModel>('tasks')
    .query(
      Q.where('plant_id', plantId),
      Q.where('playbook_id', playbookId),
      Q.where('deleted_at', null)
    )
    .fetch();

  // Build phase date windows from playbook steps
  const phaseWindows = buildPhaseWindows(playbook, startDate);

  // Determine current phase by date
  let currentPhaseIndex = 0;

  for (let i = 0; i < phaseWindows.length; i++) {
    const window = phaseWindows[i];
    if (now >= window.startDate && (!window.endDate || now < window.endDate)) {
      currentPhaseIndex = i;
      break;
    }
  }

  // Check if key tasks indicate phase transition
  const phaseFromTasks = determinePhaseFromTaskCompletion(
    tasks,
    playbook,
    currentPhaseIndex
  );
  if (phaseFromTasks !== null && phaseFromTasks > currentPhaseIndex) {
    currentPhaseIndex = phaseFromTasks;
  }

  const currentWindow = phaseWindows[currentPhaseIndex];
  const currentPhase = playbook.phaseOrder[currentPhaseIndex];
  const daysInPhase = Math.floor(
    now.diff(currentWindow.startDate, 'days').days
  );
  const estimatedPhaseDuration = currentWindow.endDate
    ? Math.floor(
        currentWindow.endDate.diff(currentWindow.startDate, 'days').days
      )
    : null;

  const progressPercent =
    estimatedPhaseDuration && estimatedPhaseDuration > 0
      ? Math.min(100, Math.round((daysInPhase / estimatedPhaseDuration) * 100))
      : 0;

  return {
    currentPhase,
    phaseIndex: currentPhaseIndex,
    phaseStartDate: currentWindow.startDate.toISO()!,
    phaseEndDate: currentWindow.endDate?.toISO() ?? null,
    daysInPhase,
    estimatedPhaseDuration,
    progressPercent,
  };
}

/**
 * Build phase date windows from playbook steps
 */
function buildPhaseWindows(
  playbook: Playbook,
  startDate: DateTime
): {
  phase: GrowPhase;
  startDate: DateTime;
  endDate: DateTime | null;
}[] {
  const windows: {
    phase: GrowPhase;
    startDate: DateTime;
    endDate: DateTime | null;
  }[] = [];

  // Group steps by phase and find min/max relativeDay for each phase
  const phaseRanges: Record<string, { min: number; max: number }> = {};

  for (const step of playbook.steps) {
    const endDay = step.relativeDay + (step.durationDays || 0);
    if (!phaseRanges[step.phase]) {
      phaseRanges[step.phase] = { min: step.relativeDay, max: endDay };
    } else {
      phaseRanges[step.phase].min = Math.min(
        phaseRanges[step.phase].min,
        step.relativeDay
      );
      phaseRanges[step.phase].max = Math.max(
        phaseRanges[step.phase].max,
        endDay
      );
    }
  }

  // Build windows based on the actual step relative days
  for (let i = 0; i < playbook.phaseOrder.length; i++) {
    const phase = playbook.phaseOrder[i];
    const range = phaseRanges[phase];

    if (!range) {
      // No steps for this phase, use default 14-day window
      const prevPhase = i > 0 ? playbook.phaseOrder[i - 1] : null;
      const prevRange = prevPhase ? phaseRanges[prevPhase] : null;
      const startDay = prevRange ? prevRange.max : i * 14;

      windows.push({
        phase,
        startDate: startDate.plus({ days: startDay }),
        endDate:
          i < playbook.phaseOrder.length - 1
            ? startDate.plus({ days: startDay + 14 })
            : null,
      });
    } else {
      windows.push({
        phase,
        startDate: startDate.plus({ days: range.min }),
        endDate:
          i < playbook.phaseOrder.length - 1
            ? startDate.plus({ days: range.max })
            : null,
      });
    }
  }

  return windows;
}

/**
 * Determine phase from task completion (key tasks indicate phase transition)
 */
function determinePhaseFromTaskCompletion(
  tasks: TaskModel[],
  playbook: Playbook,
  currentPhaseIndex: number
): number | null {
  // Check if all tasks in current phase are completed
  const currentPhaseTasks = tasks.filter(
    (task) =>
      task.phaseIndex === currentPhaseIndex && task.status === 'completed'
  );

  const totalCurrentPhaseTasks = tasks.filter(
    (task) => task.phaseIndex === currentPhaseIndex
  ).length;

  // If 90% of current phase tasks are complete, consider moving to next phase
  if (
    totalCurrentPhaseTasks > 0 &&
    currentPhaseTasks.length / totalCurrentPhaseTasks >= 0.9
  ) {
    const nextPhaseIndex = currentPhaseIndex + 1;
    if (nextPhaseIndex < playbook.phaseOrder.length) {
      return nextPhaseIndex;
    }
  }

  return null;
}

export type GetPhaseProgressOptions = {
  plantId: string;
  playbookId: string;
  playbook: Playbook;
  currentPhaseIndex: number;
  timezone: string;
};

function calculateTaskCounts(
  phaseTasks: TaskModel[],
  now: DateTime,
  timezone: string
): { currentTasks: number; upcomingTasks: number } {
  let currentTasks = 0;
  let upcomingTasks = 0;

  for (const task of phaseTasks) {
    if (task.status === 'completed') continue;

    const dueDate = DateTime.fromISO(task.dueAtUtc, { zone: 'utc' }).setZone(
      timezone
    );
    const daysDiff = dueDate.diff(now, 'days').days;

    if (daysDiff <= 7) {
      currentTasks++;
    } else {
      upcomingTasks++;
    }
  }

  return { currentTasks, upcomingTasks };
}

function getPhaseWindow(
  playbook: Playbook,
  phase: GrowPhase
): { startDate: string | null; endDate: string | null } {
  const phaseSteps = playbook.steps.filter((step) => step.phase === phase);
  const firstStep = phaseSteps.reduce(
    (min, step) => (step.relativeDay < min ? step.relativeDay : min),
    Infinity
  );
  const lastStep = phaseSteps.reduce(
    (max, step) =>
      step.relativeDay + (step.durationDays || 0) > max
        ? step.relativeDay + (step.durationDays || 0)
        : max,
    0
  );

  return {
    startDate: firstStep !== Infinity ? `Day ${firstStep}` : null,
    endDate: lastStep > 0 ? `Day ${lastStep}` : null,
  };
}

/**
 * Get phase progress for all phases
 */
export async function getPhaseProgress(
  options: GetPhaseProgressOptions
): Promise<PhaseProgress[]> {
  const { plantId, playbookId, playbook, timezone } = options;
  const now = DateTime.now().setZone(timezone);

  const tasks = await database
    .get<TaskModel>('tasks')
    .query(
      Q.where('plant_id', plantId),
      Q.where('playbook_id', playbookId),
      Q.where('deleted_at', null)
    )
    .fetch();

  const progress: PhaseProgress[] = [];

  for (let i = 0; i < playbook.phaseOrder.length; i++) {
    const phase = playbook.phaseOrder[i];
    const phaseTasks = tasks.filter((task) => task.phaseIndex === i);

    const completedTasks = phaseTasks.filter(
      (task) => task.status === 'completed'
    ).length;

    const { currentTasks, upcomingTasks } = calculateTaskCounts(
      phaseTasks,
      now,
      timezone
    );

    const progressPercent =
      phaseTasks.length > 0
        ? Math.round((completedTasks / phaseTasks.length) * 100)
        : 0;

    const { startDate, endDate } = getPhaseWindow(playbook, phase);

    progress.push({
      phase,
      phaseIndex: i,
      totalTasks: phaseTasks.length,
      completedTasks,
      currentTasks,
      upcomingTasks,
      progressPercent,
      startDate,
      endDate,
    });
  }

  return progress;
}

export type GetPhaseSummaryOptions = {
  plantId: string;
  playbookId: string;
  phaseIndex: number;
  phase: GrowPhase;
};

/**
 * Get summary for a completed phase
 */
export async function getPhaseSummary(
  options: GetPhaseSummaryOptions
): Promise<PhaseSummary | null> {
  const { plantId, playbookId, phaseIndex, phase } = options;
  // Get all tasks for this phase
  const tasks = await database
    .get<TaskModel>('tasks')
    .query(
      Q.where('plant_id', plantId),
      Q.where('playbook_id', playbookId),
      Q.where('phase_index', phaseIndex),
      Q.where('deleted_at', null)
    )
    .fetch();

  if (tasks.length === 0) {
    return null;
  }

  const completedTasks = tasks.filter(
    (task) => task.status === 'completed'
  ).length;

  // Group by task type
  const taskTypeCounts: Record<string, number> = {};
  for (const task of tasks) {
    const taskType = (task.metadata?.taskType as string) || 'custom';
    taskTypeCounts[taskType] = (taskTypeCounts[taskType] || 0) + 1;
  }

  const activities = Object.entries(taskTypeCounts).map(
    ([taskType, count]) => ({
      taskType,
      count,
    })
  );

  // Get date range
  const dueDates = tasks
    .map((task) => DateTime.fromISO(task.dueAtUtc, { zone: 'utc' }))
    .sort((a, b) => a.toMillis() - b.toMillis());

  const startDate = dueDates[0]?.toISO() ?? '';
  const endDate = dueDates[dueDates.length - 1]?.toISO() ?? '';

  // Generate outcomes (simple for now)
  const outcomes: string[] = [];
  if (completedTasks === tasks.length) {
    outcomes.push('All tasks completed successfully');
  } else {
    outcomes.push(
      `${completedTasks} of ${tasks.length} tasks completed (${Math.round((completedTasks / tasks.length) * 100)}%)`
    );
  }

  return {
    phase,
    phaseIndex,
    startDate,
    endDate,
    totalTasks: tasks.length,
    completedTasks,
    activities,
    outcomes,
  };
}
