import type { AccessibilityProps } from 'react-native';

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
  return `${config.name} playbook, ${config.setup} setup, ${config.weekCount} weeks, ${config.taskCount} tasks`;
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
  const parts = [config.title, `due ${config.dueDate}`, config.status];

  if (config.hasReminder) {
    parts.push('has reminder');
  }

  return parts.join(', ');
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
  const status = config.isActive ? 'active' : 'inactive';
  const progress = `${config.completedTasks} of ${config.totalTasks} tasks completed`;

  return `${config.phase} phase, ${status}, ${progress}`;
}

/**
 * Creates accessibility hint for shift schedule action
 */
export function createShiftScheduleA11yHint(daysDelta: number): string {
  const direction = daysDelta > 0 ? 'forward' : 'backward';
  const days = Math.abs(daysDelta);

  return `Shifts all tasks ${direction} by ${days} ${days === 1 ? 'day' : 'days'}`;
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
  return `Trichome assessment: ${config.clearPercent}% clear, ${config.milkyPercent}% milky, ${config.amberPercent}% amber. Recommendation: ${config.recommendation}`;
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
    return `${config.stage} - current stage`;
  }
  if (config.isCompleted) {
    return `${config.stage} - completed`;
  }
  return `${config.stage} - upcoming`;
}

/**
 * Creates accessibility label for weight input field
 */
export function createWeightInputA11yLabel(config: {
  fieldName: string;
  unit: string;
  value?: number;
}): string {
  const valuePart =
    config.value != null
      ? `, current value: ${config.value} ${config.unit}`
      : '';
  return `${config.fieldName} input${valuePart}`;
}

/**
 * Creates accessibility label for stage action button
 */
export function createStageActionA11yLabel(config: {
  action: 'advance' | 'undo' | 'revert' | 'override';
  targetStage?: string;
  undoSeconds?: number;
}): string {
  const stageLabel = config.targetStage ?? 'next stage';
  switch (config.action) {
    case 'advance':
      return `Advance to ${stageLabel}`;
    case 'undo':
      return config.undoSeconds
        ? `Undo last stage change (${config.undoSeconds}s remaining)`
        : 'Undo last stage change';
    case 'revert':
      return 'Revert to previous stage';
    case 'override':
      return 'Skip to later stage';
    default:
      return 'Stage action';
  }
}

/**
 * Creates accessibility hint for stage action button
 */
export function createStageActionA11yHint(config: {
  action: 'advance' | 'undo' | 'revert' | 'override';
  targetStage?: string;
}): string {
  const stageLabel = config.targetStage ?? 'next stage';
  switch (config.action) {
    case 'advance':
      return `Double-tap to advance to ${stageLabel}`;
    case 'undo':
      return 'Double-tap to undo last stage change';
    case 'revert':
      return 'Double-tap to revert to previous stage';
    case 'override':
      return 'Double-tap to skip to a later stage';
    default:
      return 'Double-tap to perform action';
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
    `Harvest in ${config.stage} stage`,
    `updated ${config.updatedAt}`,
  ];

  if (config.dryWeight != null) {
    parts.push(`dry weight ${config.dryWeight} grams`);
  }

  if (config.hasConflict) {
    parts.push('needs review');
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
  return `Harvest progress: ${config.currentStage} stage, ${config.completedStages} of ${config.totalStages} stages completed`;
}
