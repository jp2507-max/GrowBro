/**
 * Tests for annual reminder utilities
 *
 * Requirements: 8.5
 */

import type { SourceWaterProfile } from '@/lib/nutrient-engine/types';
import {
  ANNUAL_REMINDER_INTERVAL_MS,
  EARLY_REMINDER_THRESHOLD_MS,
  getAnnualTestingEducationalContent,
  getDaysOverdue,
  getDaysUntilReminder,
  getReminderMessage,
  getWaterTestingChecklist,
  shouldShowAnnualReminder,
  shouldShowEarlyReminder,
} from '@/lib/nutrient-engine/utils/annual-reminder';

describe('annual-reminder', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const createMockProfile = (lastTestedAt: number): SourceWaterProfile => ({
    id: 'profile-1',
    name: 'Test Profile',
    baselineEc25c: 0.3,
    alkalinityMgPerLCaco3: 80,
    hardnessMgPerL: 150,
    lastTestedAt,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  describe('Constants', () => {
    it('should define correct interval for annual reminder', () => {
      const expectedDays = 365;
      const expectedMs = expectedDays * ONE_DAY_MS;

      expect(ANNUAL_REMINDER_INTERVAL_MS).toBe(expectedMs);
    });

    it('should define correct early reminder threshold', () => {
      const expectedDays = 30;
      const expectedMs = expectedDays * ONE_DAY_MS;

      expect(EARLY_REMINDER_THRESHOLD_MS).toBe(expectedMs);
    });
  });

  describe('shouldShowAnnualReminder', () => {
    it('should return false when test is recent', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 100 * ONE_DAY_MS; // 100 days ago

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowAnnualReminder(profile, currentTime)).toBe(false);
    });

    it('should return false exactly at 364 days', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 364 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowAnnualReminder(profile, currentTime)).toBe(false);
    });

    it('should return true at exactly 365 days (Requirement 8.5)', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - ANNUAL_REMINDER_INTERVAL_MS;

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowAnnualReminder(profile, currentTime)).toBe(true);
    });

    it('should return true when test is overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 400 * ONE_DAY_MS; // 400 days ago

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowAnnualReminder(profile, currentTime)).toBe(true);
    });

    it('should use Date.now() as default currentTime', () => {
      const lastTestedAt = Date.now() - 400 * ONE_DAY_MS;
      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowAnnualReminder(profile)).toBe(true);
    });
  });

  describe('shouldShowEarlyReminder', () => {
    it('should return false when test is very recent', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 100 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowEarlyReminder(profile, currentTime)).toBe(false);
    });

    it('should return false at exactly 334 days (31 days before)', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 334 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowEarlyReminder(profile, currentTime)).toBe(false);
    });

    it('should return true at 30 days before anniversary', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 335 * ONE_DAY_MS; // 30 days until 365

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowEarlyReminder(profile, currentTime)).toBe(true);
    });

    it('should return true at 1 day before anniversary', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 364 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowEarlyReminder(profile, currentTime)).toBe(true);
    });

    it('should return false when already overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 400 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);

      expect(shouldShowEarlyReminder(profile, currentTime)).toBe(false);
    });
  });

  describe('getDaysUntilReminder', () => {
    it('should return positive days when reminder is in future', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 300 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysUntil = getDaysUntilReminder(profile, currentTime);

      expect(daysUntil).toBeGreaterThan(0);
      expect(daysUntil).toBeCloseTo(65, 0); // ~65 days until 365
    });

    it('should return 0 at exactly 365 days', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - ANNUAL_REMINDER_INTERVAL_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysUntil = getDaysUntilReminder(profile, currentTime);

      expect(daysUntil).toBe(0);
    });

    it('should return negative days when overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 400 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysUntil = getDaysUntilReminder(profile, currentTime);

      expect(daysUntil).toBeLessThan(0);
      expect(daysUntil).toBeCloseTo(-35, 0); // ~35 days overdue
    });
  });

  describe('getDaysOverdue', () => {
    it('should return 0 when not overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 300 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysOverdue = getDaysOverdue(profile, currentTime);

      expect(daysOverdue).toBe(0);
    });

    it('should return 0 at exactly 365 days', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - ANNUAL_REMINDER_INTERVAL_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysOverdue = getDaysOverdue(profile, currentTime);

      expect(daysOverdue).toBe(0);
    });

    it('should return positive days when overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 400 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysOverdue = getDaysOverdue(profile, currentTime);

      expect(daysOverdue).toBeGreaterThan(0);
      expect(daysOverdue).toBeCloseTo(35, 0); // ~35 days overdue
    });

    it('should return correct value for severely overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 500 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const daysOverdue = getDaysOverdue(profile, currentTime);

      expect(daysOverdue).toBeGreaterThan(100);
      expect(daysOverdue).toBeCloseTo(135, 0); // ~135 days overdue
    });
  });

  describe('getReminderMessage', () => {
    it('should return null when not due for reminder', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 300 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const message = getReminderMessage(profile, currentTime);

      expect(message).toBeNull();
    });

    it('should return info message for early reminder (30 days before)', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 335 * ONE_DAY_MS;

      const profile = createMockProfile(lastTestedAt);
      const message = getReminderMessage(profile, currentTime);

      expect(message).not.toBeNull();
      expect(message?.severity).toBe('info');
      expect(message?.title).toBe('Water Test Coming Due');
      expect(message?.message).toContain('30 days');
      expect(message?.checklistLink).toContain('checklist');
      expect(message?.actionLabel).toContain('Guide');
    });

    it('should return warning message when recently overdue', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 380 * ONE_DAY_MS; // ~15 days overdue

      const profile = createMockProfile(lastTestedAt);
      const message = getReminderMessage(profile, currentTime);

      expect(message).not.toBeNull();
      expect(message?.severity).toBe('warning');
      expect(message?.title).toBe('Time to Retest Water');
      expect(message?.message).toContain('over a year');
      expect(message?.message).toContain(profile.name);
      expect(message?.checklistLink).toContain('checklist');
      expect(message?.actionLabel).toContain('Retest');
    });

    it('should return urgent message when severely overdue (>90 days)', () => {
      const currentTime = Date.now();
      const lastTestedAt = currentTime - 500 * ONE_DAY_MS; // ~135 days overdue

      const profile = createMockProfile(lastTestedAt);
      const message = getReminderMessage(profile, currentTime);

      expect(message).not.toBeNull();
      expect(message?.severity).toBe('urgent');
      expect(message?.title).toBe('Water Test Overdue');
      expect(message?.message).toContain('overdue');
      expect(message?.checklistLink).toContain('checklist');
      expect(message?.actionLabel).toContain('Update');
    });

    it('should include checklist link in all messages (Requirement 8.5)', () => {
      const currentTime = Date.now();

      // Test early reminder
      const profileEarly = createMockProfile(currentTime - 335 * ONE_DAY_MS);
      const messageEarly = getReminderMessage(profileEarly, currentTime);
      expect(messageEarly?.checklistLink).toContain('checklist');

      // Test warning
      const profileWarning = createMockProfile(currentTime - 380 * ONE_DAY_MS);
      const messageWarning = getReminderMessage(profileWarning, currentTime);
      expect(messageWarning?.checklistLink).toContain('checklist');

      // Test urgent
      const profileUrgent = createMockProfile(currentTime - 500 * ONE_DAY_MS);
      const messageUrgent = getReminderMessage(profileUrgent, currentTime);
      expect(messageUrgent?.checklistLink).toContain('checklist');
    });
  });

  describe('getAnnualTestingEducationalContent', () => {
    it('should return educational tips about annual testing', () => {
      const content = getAnnualTestingEducationalContent();

      expect(content.length).toBeGreaterThan(4);
      expect(content).toContain(
        expect.stringContaining('water quality can change')
      );
      expect(content).toContain(expect.stringContaining('Annual retesting'));
    });

    it('should mention key parameters to test', () => {
      const content = getAnnualTestingEducationalContent();

      const combinedText = content.join(' ');
      expect(combinedText).toContain('pH');
      expect(combinedText).toContain('EC');
      expect(combinedText).toContain('alkalinity');
      expect(combinedText).toContain('hardness');
    });
  });

  describe('getWaterTestingChecklist', () => {
    it('should return comprehensive checklist items', () => {
      const checklist = getWaterTestingChecklist();

      expect(checklist.length).toBeGreaterThanOrEqual(5);
    });

    it('should include sample collection step', () => {
      const checklist = getWaterTestingChecklist();

      expect(checklist).toContain(
        expect.stringContaining('Collect fresh sample')
      );
    });

    it('should include key parameters to test', () => {
      const checklist = getWaterTestingChecklist();

      const combinedText = checklist.join(' ');
      expect(combinedText).toContain('pH');
      expect(combinedText).toContain('EC');
      expect(combinedText).toContain('alkalinity');
      expect(combinedText).toContain('hardness');
    });

    it('should include recording results step', () => {
      const checklist = getWaterTestingChecklist();

      expect(checklist).toContain(expect.stringContaining('Record'));
      expect(checklist).toContain(expect.stringContaining('GrowBro'));
    });
  });
});
