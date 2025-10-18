import deTranslations from '@/translations/de.json';
import enTranslations from '@/translations/en.json';

describe('Playbook Translations', () => {
  describe('ICU MessageFormat Validation', () => {
    describe('English translations', () => {
      test('should have valid ICU format for pluralization', () => {
        const { playbooks } = (enTranslations as any).community;

        // Check pluralization patterns
        expect(playbooks.selection.preview.totalWeeks_one).toContain(
          '{{count}}'
        );
        expect(playbooks.selection.preview.totalWeeks_other).toContain(
          '{{count}}'
        );
        expect(playbooks.selection.preview.taskCount_one).toContain(
          '{{count}}'
        );
        expect(playbooks.selection.preview.taskCount_other).toContain(
          '{{count}}'
        );

        expect(playbooks.apply.success_one).toContain('{{count}}');
        expect(playbooks.apply.success_other).toContain('{{count}}');

        expect(playbooks.schedule.shift.affectedTasks_one).toContain(
          '{{count}}'
        );
        expect(playbooks.schedule.shift.affectedTasks_other).toContain(
          '{{count}}'
        );
        expect(playbooks.schedule.shift.conflicts_one).toContain('{{count}}');
        expect(playbooks.schedule.shift.conflicts_other).toContain('{{count}}');

        expect(playbooks.progress.completedTasks_one).toContain('{{count}}');
        expect(playbooks.progress.completedTasks_other).toContain('{{count}}');
        expect(playbooks.progress.completedTasks_one).toContain('{{total}}');
        expect(playbooks.progress.completedTasks_other).toContain('{{total}}');

        expect(playbooks.community.adopt.ratings_one).toContain('{{count}}');
        expect(playbooks.community.adopt.ratings_other).toContain('{{count}}');
        expect(playbooks.community.adopt.adoptions_one).toContain('{{count}}');
        expect(playbooks.community.adopt.adoptions_other).toContain(
          '{{count}}'
        );
      });

      test('should have valid ICU format for interpolation', () => {
        const { playbooks } = (enTranslations as any).community;

        // Check interpolation patterns
        expect(playbooks.adjustments.confidence).toContain('{{percent}}');
        expect(playbooks.saveAsTemplateDescription).toContain('{{percentage}}');
        expect(playbooks.saveAsTemplateDescription).toContain('{{customized}}');
        expect(playbooks.saveAsTemplateDescription).toContain('{{total}}');

        expect(playbooks.schedule.shift.undoAvailable).toContain('{{seconds}}');
        expect(playbooks.schedule.shift.firstNewDate).toContain('{{date}}');
        expect(playbooks.schedule.shift.lastNewDate).toContain('{{date}}');

        expect(playbooks.progress.transitionNotice).toContain('{{phase}}');

        expect(playbooks.trichome.nudge.message).toContain('{{days}}');

        expect(playbooks.community.adopt.author).toContain('{{author}}');
      });

      test('should have valid accessibility labels with interpolation', () => {
        const { playbooks } = (enTranslations as any).community;

        expect(playbooks.accessibility.playbookCard).toContain('{{name}}');
        expect(playbooks.accessibility.playbookCard).toContain('{{setup}}');
        expect(playbooks.accessibility.playbookCard).toContain('{{weeks}}');
        expect(playbooks.accessibility.playbookCard).toContain('{{tasks}}');

        expect(playbooks.accessibility.taskItem).toContain('{{title}}');
        expect(playbooks.accessibility.taskItem).toContain('{{date}}');
        expect(playbooks.accessibility.taskItem).toContain('{{status}}');

        expect(playbooks.accessibility.phaseProgress).toContain('{{phase}}');
        expect(playbooks.accessibility.phaseProgress).toContain('{{status}}');
        expect(playbooks.accessibility.phaseProgress).toContain(
          '{{completed}}'
        );
        expect(playbooks.accessibility.phaseProgress).toContain('{{total}}');

        expect(playbooks.accessibility.shiftScheduleHint).toContain(
          '{{direction}}'
        );
        expect(playbooks.accessibility.shiftScheduleHint).toContain('{{days}}');
        expect(playbooks.accessibility.shiftScheduleHint).toContain(
          '{{daysUnit}}'
        );

        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{clear}}'
        );
        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{milky}}'
        );
        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{amber}}'
        );
        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{recommendation}}'
        );
      });
    });

    describe('German translations', () => {
      test('should have valid ICU format for pluralization', () => {
        const { playbooks } = (deTranslations as any).community;

        // Check pluralization patterns
        expect(playbooks.selection.preview.totalWeeks_one).toContain(
          '{{count}}'
        );
        expect(playbooks.selection.preview.totalWeeks_other).toContain(
          '{{count}}'
        );
        expect(playbooks.selection.preview.taskCount_one).toContain(
          '{{count}}'
        );
        expect(playbooks.selection.preview.taskCount_other).toContain(
          '{{count}}'
        );

        expect(playbooks.apply.success_one).toContain('{{count}}');
        expect(playbooks.apply.success_other).toContain('{{count}}');

        expect(playbooks.schedule.shift.affectedTasks_one).toContain(
          '{{count}}'
        );
        expect(playbooks.schedule.shift.affectedTasks_other).toContain(
          '{{count}}'
        );
        expect(playbooks.schedule.shift.conflicts_one).toContain('{{count}}');
        expect(playbooks.schedule.shift.conflicts_other).toContain('{{count}}');

        expect(playbooks.progress.completedTasks_one).toContain('{{count}}');
        expect(playbooks.progress.completedTasks_other).toContain('{{count}}');
        expect(playbooks.progress.completedTasks_one).toContain('{{total}}');
        expect(playbooks.progress.completedTasks_other).toContain('{{total}}');

        expect(playbooks.community.adopt.ratings_one).toContain('{{count}}');
        expect(playbooks.community.adopt.ratings_other).toContain('{{count}}');
        expect(playbooks.community.adopt.adoptions_one).toContain('{{count}}');
        expect(playbooks.community.adopt.adoptions_other).toContain(
          '{{count}}'
        );
      });

      test('should have valid ICU format for interpolation', () => {
        const { playbooks } = (deTranslations as any).community;

        // Check interpolation patterns
        expect(playbooks.adjustments.confidence).toContain('{{percent}}');
        expect(playbooks.saveAsTemplateDescription).toContain('{{percentage}}');
        expect(playbooks.saveAsTemplateDescription).toContain('{{customized}}');
        expect(playbooks.saveAsTemplateDescription).toContain('{{total}}');

        expect(playbooks.schedule.shift.undoAvailable).toContain('{{seconds}}');
        expect(playbooks.schedule.shift.firstNewDate).toContain('{{date}}');
        expect(playbooks.schedule.shift.lastNewDate).toContain('{{date}}');

        expect(playbooks.progress.transitionNotice).toContain('{{phase}}');

        expect(playbooks.trichome.nudge.message).toContain('{{days}}');

        expect(playbooks.community.adopt.author).toContain('{{author}}');
      });

      test('should have valid accessibility labels with interpolation', () => {
        const { playbooks } = (deTranslations as any).community;

        expect(playbooks.accessibility.playbookCard).toContain('{{name}}');
        expect(playbooks.accessibility.playbookCard).toContain('{{setup}}');
        expect(playbooks.accessibility.playbookCard).toContain('{{weeks}}');
        expect(playbooks.accessibility.playbookCard).toContain('{{tasks}}');

        expect(playbooks.accessibility.taskItem).toContain('{{title}}');
        expect(playbooks.accessibility.taskItem).toContain('{{date}}');
        expect(playbooks.accessibility.taskItem).toContain('{{status}}');

        expect(playbooks.accessibility.phaseProgress).toContain('{{phase}}');
        expect(playbooks.accessibility.phaseProgress).toContain('{{status}}');
        expect(playbooks.accessibility.phaseProgress).toContain(
          '{{completed}}'
        );
        expect(playbooks.accessibility.phaseProgress).toContain('{{total}}');

        expect(playbooks.accessibility.shiftScheduleHint).toContain(
          '{{direction}}'
        );
        expect(playbooks.accessibility.shiftScheduleHint).toContain('{{days}}');
        expect(playbooks.accessibility.shiftScheduleHint).toContain(
          '{{daysUnit}}'
        );

        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{clear}}'
        );
        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{milky}}'
        );
        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{amber}}'
        );
        expect(playbooks.accessibility.trichomeAssessment).toContain(
          '{{recommendation}}'
        );
      });
    });

    describe('Translation key parity', () => {
      test('should have matching keys between EN and DE', () => {
        const enKeys = Object.keys((enTranslations as any).community.playbooks);
        const deKeys = Object.keys((deTranslations as any).community.playbooks);

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });

      test('should have matching nested keys for selection', () => {
        const enKeys = Object.keys(
          (enTranslations as any).community.playbooks.selection
        );
        const deKeys = Object.keys(
          (deTranslations as any).community.playbooks.selection
        );

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });

      test('should have matching nested keys for schedule.shift', () => {
        const enKeys = Object.keys(
          (enTranslations as any).community.playbooks.schedule.shift
        );
        const deKeys = Object.keys(
          (deTranslations as any).community.playbooks.schedule.shift
        );

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });

      test('should have matching nested keys for trichome', () => {
        const enKeys = Object.keys(
          (enTranslations as any).community.playbooks.trichome
        );
        const deKeys = Object.keys(
          (deTranslations as any).community.playbooks.trichome
        );

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });

      test('should have matching nested keys for community', () => {
        const enKeys = Object.keys(
          (enTranslations as any).community.playbooks.community
        );
        const deKeys = Object.keys(
          (deTranslations as any).community.playbooks.community
        );

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });

      test('should have matching nested keys for accessibility', () => {
        const enKeys = Object.keys(
          (enTranslations as any).community.playbooks.accessibility
        );
        const deKeys = Object.keys(
          (deTranslations as any).community.playbooks.accessibility
        );

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });
    });

    describe('Phases translations', () => {
      test('should have all phase translations in English', () => {
        const { phases } = (enTranslations as any).community;

        expect(phases.seedling).toBeDefined();
        expect(phases.veg).toBeDefined();
        expect(phases.flower).toBeDefined();
        expect(phases.harvest).toBeDefined();
      });

      test('should have all phase translations in German', () => {
        const { phases } = (deTranslations as any).community;

        expect(phases.seedling).toBeDefined();
        expect(phases.veg).toBeDefined();
        expect(phases.flower).toBeDefined();
        expect(phases.harvest).toBeDefined();
      });

      test('should have matching phase keys between EN and DE', () => {
        const enKeys = Object.keys((enTranslations as any).community.phases);
        const deKeys = Object.keys((deTranslations as any).community.phases);

        expect(enKeys.sort()).toEqual(deKeys.sort());
      });
    });
  });
});
