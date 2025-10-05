import {
  createA11yProps,
  createPhaseA11yLabel,
  createPlaybookA11yLabel,
  createShiftScheduleA11yHint,
  createTaskA11yLabel,
  createTrichomeA11yLabel,
} from '../labels';

describe('Accessibility Labels', () => {
  describe('createA11yProps', () => {
    test('should create basic accessibility props', () => {
      const props = createA11yProps({
        label: 'Submit button',
        role: 'button',
      });

      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Submit button');
      expect(props.accessibilityRole).toBe('button');
    });

    test('should include hint when provided', () => {
      const props = createA11yProps({
        label: 'Submit',
        hint: 'Double tap to submit the form',
      });

      expect(props.accessibilityHint).toBe('Double tap to submit the form');
    });

    test('should include state when provided', () => {
      const props = createA11yProps({
        label: 'Toggle',
        state: {
          disabled: true,
          selected: false,
        },
      });

      expect(props.accessibilityState).toEqual({
        disabled: true,
        selected: false,
      });
    });

    test('should handle all state properties', () => {
      const props = createA11yProps({
        label: 'Checkbox',
        state: {
          disabled: false,
          selected: true,
          checked: true,
          expanded: false,
          busy: false,
        },
      });

      expect(props.accessibilityState).toEqual({
        disabled: false,
        selected: true,
        checked: true,
        expanded: false,
        busy: false,
      });
    });
  });

  describe('createPlaybookA11yLabel', () => {
    test('should create playbook accessibility label', () => {
      const label = createPlaybookA11yLabel({
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        weekCount: 12,
        taskCount: 45,
      });

      expect(label).toBe(
        'Auto Indoor playbook, auto_indoor setup, 12 weeks, 45 tasks'
      );
    });

    test('should handle single week and task', () => {
      const label = createPlaybookA11yLabel({
        name: 'Quick Grow',
        setup: 'auto_outdoor',
        weekCount: 1,
        taskCount: 1,
      });

      expect(label).toContain('1 weeks');
      expect(label).toContain('1 tasks');
    });
  });

  describe('createTaskA11yLabel', () => {
    test('should create task accessibility label without reminder', () => {
      const label = createTaskA11yLabel({
        title: 'Water plants',
        dueDate: 'tomorrow',
        status: 'pending',
      });

      expect(label).toBe('Water plants, due tomorrow, pending');
    });

    test('should create task accessibility label with reminder', () => {
      const label = createTaskA11yLabel({
        title: 'Feed nutrients',
        dueDate: 'today',
        status: 'pending',
        hasReminder: true,
      });

      expect(label).toBe('Feed nutrients, due today, pending, has reminder');
    });

    test('should handle completed status', () => {
      const label = createTaskA11yLabel({
        title: 'Prune leaves',
        dueDate: 'yesterday',
        status: 'completed',
      });

      expect(label).toContain('completed');
    });

    test('should handle skipped status', () => {
      const label = createTaskA11yLabel({
        title: 'Training',
        dueDate: 'last week',
        status: 'skipped',
      });

      expect(label).toContain('skipped');
    });
  });

  describe('createPhaseA11yLabel', () => {
    test('should create active phase accessibility label', () => {
      const label = createPhaseA11yLabel({
        phase: 'Vegetative',
        completedTasks: 10,
        totalTasks: 20,
        isActive: true,
      });

      expect(label).toBe('Vegetative phase, active, 10 of 20 tasks completed');
    });

    test('should create inactive phase accessibility label', () => {
      const label = createPhaseA11yLabel({
        phase: 'Flowering',
        completedTasks: 0,
        totalTasks: 15,
        isActive: false,
      });

      expect(label).toBe('Flowering phase, inactive, 0 of 15 tasks completed');
    });

    test('should handle fully completed phase', () => {
      const label = createPhaseA11yLabel({
        phase: 'Seedling',
        completedTasks: 5,
        totalTasks: 5,
        isActive: false,
      });

      expect(label).toContain('5 of 5 tasks completed');
    });
  });

  describe('createShiftScheduleA11yHint', () => {
    test('should create hint for forward shift', () => {
      const hint = createShiftScheduleA11yHint(3);

      expect(hint).toBe('Shifts all tasks forward by 3 days');
    });

    test('should create hint for backward shift', () => {
      const hint = createShiftScheduleA11yHint(-5);

      expect(hint).toBe('Shifts all tasks backward by 5 days');
    });

    test('should handle single day forward', () => {
      const hint = createShiftScheduleA11yHint(1);

      expect(hint).toBe('Shifts all tasks forward by 1 day');
    });

    test('should handle single day backward', () => {
      const hint = createShiftScheduleA11yHint(-1);

      expect(hint).toBe('Shifts all tasks backward by 1 day');
    });
  });

  describe('createTrichomeA11yLabel', () => {
    test('should create trichome assessment accessibility label', () => {
      const label = createTrichomeA11yLabel({
        clearPercent: 10,
        milkyPercent: 70,
        amberPercent: 20,
        recommendation: 'Harvest now for balanced effects',
      });

      expect(label).toBe(
        'Trichome assessment: 10% clear, 70% milky, 20% amber. Recommendation: Harvest now for balanced effects'
      );
    });

    test('should handle all clear trichomes', () => {
      const label = createTrichomeA11yLabel({
        clearPercent: 100,
        milkyPercent: 0,
        amberPercent: 0,
        recommendation: 'Wait longer',
      });

      expect(label).toContain('100% clear');
      expect(label).toContain('0% milky');
      expect(label).toContain('0% amber');
    });

    test('should handle all amber trichomes', () => {
      const label = createTrichomeA11yLabel({
        clearPercent: 0,
        milkyPercent: 0,
        amberPercent: 100,
        recommendation: 'Harvest immediately',
      });

      expect(label).toContain('100% amber');
    });
  });
});
