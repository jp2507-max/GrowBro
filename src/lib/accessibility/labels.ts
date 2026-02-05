import type { AccessibilityProps } from 'react-native';

import { translate } from '@/lib/i18n';

/**
 * Creates accessibility props for interactive elements
 */
export function createA11yProps(config: {
  label: string;
  hint?: string;
  role?: AccessibilityProps['accessibilityRole'];
  state?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    expanded?: boolean;
    busy?: boolean;
  };
}): AccessibilityProps {
  const props: AccessibilityProps = {
    accessible: true,
    accessibilityLabel: config.label,
    accessibilityRole: config.role,
  };

  if (config.hint) {
    props.accessibilityHint = config.hint;
  }

  if (config.state) {
    props.accessibilityState = config.state;
  }

  return props;
}

/**
 * Creates accessibility label for playbook items
 */
export function createPlaybookA11yLabel(config: {
  name: string;
  setup: string;
  weekCount: number;
  taskCount: number;
}): string {
  return translate('playbooks.accessibility.playbook_card', {
    name: config.name,
    setup: config.setup,
    weeks: config.weekCount,
    tasks: config.taskCount,
  });
}

function getTaskStatusLabel(
  status: 'pending' | 'completed' | 'skipped'
): string {
  switch (status) {
    case 'completed':
      return translate('accessibility.task.status_completed');
    case 'skipped':
      return translate('accessibility.task.status_skipped');
    default:
      return translate('accessibility.task.status_pending');
  }
}

/**
 * Creates accessibility label for task items
 */
export function createTaskA11yLabel(config: {
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'skipped';
  hasReminder?: boolean;
}): string {
  const reminder = config.hasReminder
    ? translate('playbooks.accessibility.task_item_with_reminder')
    : '';

  return translate('playbooks.accessibility.task_item', {
    title: config.title,
    date: config.dueDate,
    status: getTaskStatusLabel(config.status),
    reminder,
  });
}

/**
 * Creates accessibility label for phase progress
 */
export function createPhaseA11yLabel(config: {
  phase: string;
  completedTasks: number;
  totalTasks: number;
  isActive: boolean;
}): string {
  const status = config.isActive
    ? translate('accessibility.phase.status_active')
    : translate('accessibility.phase.status_inactive');

  return translate('playbooks.accessibility.phase_progress', {
    phase: config.phase,
    status,
    completed: config.completedTasks,
    total: config.totalTasks,
  });
}

/**
 * Creates accessibility hint for shift schedule action
 */
export function createShiftScheduleA11yHint(daysDelta: number): string {
  const direction =
    daysDelta > 0
      ? translate('accessibility.shift.direction_forward')
      : translate('accessibility.shift.direction_backward');
  const days = Math.abs(daysDelta);
  const daysUnit =
    days === 1
      ? translate('accessibility.shift.day_one')
      : translate('accessibility.shift.day_other');

  return translate('playbooks.accessibility.shift_schedule_hint', {
    direction,
    days,
    daysUnit,
  });
}

/**
 * Creates accessibility label for trichome assessment
 */
export function createTrichomeA11yLabel(config: {
  clearPercent: number;
  milkyPercent: number;
  amberPercent: number;
  recommendation: string;
}): string {
  return translate('playbooks.accessibility.trichome_assessment', {
    clear: config.clearPercent,
    milky: config.milkyPercent,
    amber: config.amberPercent,
    recommendation: config.recommendation,
  });
}

/**
 * Creates accessibility label for harvest stage indicator
 */
export function createHarvestStageA11yLabel(config: {
  stage: string;
  isCompleted: boolean;
  isCurrent: boolean;
}): string {
  if (config.isCurrent) {
    return translate('accessibility.harvest.stage_current', {
      stage: config.stage,
    });
  }
  if (config.isCompleted) {
    return translate('accessibility.harvest.stage_completed', {
      stage: config.stage,
    });
  }
  return translate('accessibility.harvest.stage_upcoming', {
    stage: config.stage,
  });
}

/**
 * Creates accessibility label for weight input field
 */
export function createWeightInputA11yLabel(config: {
  fieldName: string;
  unit: string;
  value?: number;
}): string {
  if (config.value != null) {
    return translate('accessibility.form.input_with_value', {
      field: config.fieldName,
      value: config.value,
      unit: config.unit,
    });
  }

  return translate('accessibility.form.input_without_value', {
    field: config.fieldName,
  });
}

/**
 * Creates accessibility label for stage action button
 */
export function createStageActionA11yLabel(config: {
  action: 'advance' | 'undo' | 'revert' | 'override';
  targetStage?: string;
  undoSeconds?: number;
}): string {
  const stageLabel =
    config.targetStage ?? translate('accessibility.stage_action.next_stage');
  switch (config.action) {
    case 'advance':
      return translate('accessibility.stage_action.advance_label', {
        stage: stageLabel,
      });
    case 'undo':
      return config.undoSeconds
        ? translate('accessibility.stage_action.undo_label_with_time', {
            seconds: config.undoSeconds,
          })
        : translate('accessibility.stage_action.undo_label');
    case 'revert':
      return translate('accessibility.stage_action.revert_label');
    case 'override':
      return translate('accessibility.stage_action.override_label');
    default:
      return translate('accessibility.stage_action.default_label');
  }
}

/**
 * Creates accessibility hint for stage action button
 */
export function createStageActionA11yHint(config: {
  action: 'advance' | 'undo' | 'revert' | 'override';
  targetStage?: string;
}): string {
  const stageLabel =
    config.targetStage ?? translate('accessibility.stage_action.next_stage');
  switch (config.action) {
    case 'advance':
      return translate('accessibility.stage_action.advance_hint', {
        stage: stageLabel,
      });
    case 'undo':
      return translate('accessibility.stage_action.undo_hint');
    case 'revert':
      return translate('accessibility.stage_action.revert_hint');
    case 'override':
      return translate('accessibility.stage_action.override_hint');
    default:
      return translate('accessibility.stage_action.default_hint');
  }
}

/**
 * Creates accessibility label for harvest history item
 */
export function createHarvestHistoryA11yLabel(config: {
  stage: string;
  updatedAt: string;
  dryWeight?: number;
  hasConflict: boolean;
}): string {
  const parts = [
    translate('accessibility.harvest.history_base', {
      stage: config.stage,
      updatedAt: config.updatedAt,
    }),
  ];

  if (config.dryWeight != null) {
    parts.push(
      translate('accessibility.harvest.history_dry_weight', {
        weight: config.dryWeight,
      })
    );
  }

  if (config.hasConflict) {
    parts.push(translate('accessibility.harvest.history_conflict'));
  }

  return parts.join(', ');
}

/**
 * Creates accessibility label for stage progress indicator
 */
export function createStageProgressA11yLabel(config: {
  currentStage: string;
  totalStages: number;
  completedStages: number;
}): string {
  return translate('accessibility.harvest.progress', {
    stage: config.currentStage,
    completed: config.completedStages,
    total: config.totalStages,
  });
}
