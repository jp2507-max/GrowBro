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
