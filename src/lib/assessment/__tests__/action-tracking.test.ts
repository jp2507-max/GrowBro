/**
 * Action Tracking Tests
 *
 * Tests action tracking for analytics and model improvement.
 */

import type { AssessmentResult } from '@/types/assessment';

import {
  ActionTrackingService,
  actionTrackingService,
  trackCommunityCTA,
  trackHelpfulVote,
  trackIssueResolution,
  trackPlaybookAdjustment,
  trackRetake,
  trackTaskCreation,
} from '../action-tracking';
import { getAssessmentClass } from '../assessment-classes';

describe('ActionTrackingService', () => {
  let service: ActionTrackingService;
  let mockAssessment: AssessmentResult;

  beforeEach(() => {
    service = new ActionTrackingService();
    service.clearEvents();

    mockAssessment = {
      topClass: getAssessmentClass('nitrogen_deficiency'),
      rawConfidence: 0.88,
      calibratedConfidence: 0.85,
      perImage: [],
      aggregationMethod: 'majority-vote',
      processingTimeMs: 500,
      mode: 'device',
      modelVersion: 'v1.0.0',
    };
  });

  describe('trackTaskCreation', () => {
    it('should track task creation event', () => {
      service.trackTaskCreation('assessment-1', mockAssessment, {
        taskCount: 3,
        plantId: 'plant-1',
        timezone: 'UTC',
      });

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('task_created');
      expect(events[0].assessmentId).toBe('assessment-1');
      expect(events[0].classId).toBe('nitrogen_deficiency');
      expect(events[0].confidence).toBe(0.85);
      expect(events[0].inferenceMode).toBe('device');
      expect(events[0].metadata?.taskCount).toBe(3);
    });

    it('should not include plantId in telemetry for privacy', () => {
      service.trackTaskCreation('assessment-1', mockAssessment, {
        taskCount: 2,
        plantId: 'plant-1',
        timezone: 'UTC',
      });

      const events = service.getEvents();
      expect(events[0].metadata?.plantId).toBeUndefined();
    });
  });

  describe('trackPlaybookAdjustment', () => {
    it('should track playbook adjustment acceptance', () => {
      service.trackPlaybookAdjustment('assessment-1', mockAssessment, {
        adjustmentCount: 2,
        accepted: true,
        plantId: 'plant-1',
      });

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('playbook_adjusted');
      expect(events[0].metadata?.accepted).toBe(true);
      expect(events[0].metadata?.adjustmentCount).toBe(2);
    });

    it('should track playbook adjustment rejection', () => {
      service.trackPlaybookAdjustment('assessment-1', mockAssessment, {
        adjustmentCount: 1,
        accepted: false,
        plantId: 'plant-1',
      });

      const events = service.getEvents();
      expect(events[0].metadata?.accepted).toBe(false);
    });
  });

  describe('trackCommunityCTA', () => {
    it('should track community CTA click', () => {
      service.trackCommunityCTA('assessment-1', mockAssessment);

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('community_cta_clicked');
      expect(events[0].assessmentId).toBe('assessment-1');
    });
  });

  describe('trackRetake', () => {
    it('should track retake photo action', () => {
      service.trackRetake('assessment-1', mockAssessment);

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('retake_initiated');
    });
  });

  describe('trackHelpfulVote', () => {
    it('should track helpful vote', () => {
      service.trackHelpfulVote('assessment-1', mockAssessment, true);

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('helpful_vote');
    });

    it('should track not helpful vote', () => {
      service.trackHelpfulVote('assessment-1', mockAssessment, false);

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('not_helpful_vote');
    });
  });

  describe('trackIssueResolution', () => {
    it('should track issue resolved', () => {
      service.trackIssueResolution('assessment-1', mockAssessment, true);

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('issue_resolved');
    });

    it('should track issue not resolved', () => {
      service.trackIssueResolution('assessment-1', mockAssessment, false);

      const events = service.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('issue_not_resolved');
    });
  });

  describe('getEventCount', () => {
    it('should count events by type', () => {
      service.trackTaskCreation('assessment-1', mockAssessment, {
        taskCount: 1,
        plantId: 'plant-1',
        timezone: 'UTC',
      });
      service.trackTaskCreation('assessment-2', mockAssessment, {
        taskCount: 2,
        plantId: 'plant-1',
        timezone: 'UTC',
      });
      service.trackCommunityCTA('assessment-3', mockAssessment);

      expect(service.getEventCount('task_created')).toBe(2);
      expect(service.getEventCount('community_cta_clicked')).toBe(1);
      expect(service.getEventCount('helpful_vote')).toBe(0);
    });
  });

  describe('getEventsForAssessment', () => {
    it('should get all events for a specific assessment', () => {
      service.trackTaskCreation('assessment-1', mockAssessment, {
        taskCount: 1,
        plantId: 'plant-1',
        timezone: 'UTC',
      });
      service.trackCommunityCTA('assessment-1', mockAssessment);
      service.trackRetake('assessment-2', mockAssessment);

      const events = service.getEventsForAssessment('assessment-1');
      expect(events.length).toBe(2);
      expect(events.every((e) => e.assessmentId === 'assessment-1')).toBe(true);
    });
  });

  describe('clearEvents', () => {
    it('should clear all tracked events', () => {
      service.trackTaskCreation('assessment-1', mockAssessment, {
        taskCount: 1,
        plantId: 'plant-1',
        timezone: 'UTC',
      });
      service.trackCommunityCTA('assessment-1', mockAssessment);

      expect(service.getEvents().length).toBe(2);

      service.clearEvents();

      expect(service.getEvents().length).toBe(0);
    });
  });

  describe('convenience functions', () => {
    it('should track task creation via convenience function', () => {
      // Convenience functions use the singleton, so clear it first
      actionTrackingService.clearEvents();

      trackTaskCreation('assessment-1', mockAssessment, {
        taskCount: 1,
        plantId: 'plant-1',
        timezone: 'UTC',
      });

      // Check the singleton instance
      const events = actionTrackingService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('task_created');
    });

    it('should track playbook adjustment via convenience function', () => {
      actionTrackingService.clearEvents();

      trackPlaybookAdjustment('assessment-1', mockAssessment, {
        adjustmentCount: 1,
        accepted: true,
        plantId: 'plant-1',
      });

      const events = actionTrackingService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('playbook_adjusted');
    });

    it('should track community CTA via convenience function', () => {
      actionTrackingService.clearEvents();

      trackCommunityCTA('assessment-1', mockAssessment);

      const events = actionTrackingService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('community_cta_clicked');
    });

    it('should track retake via convenience function', () => {
      actionTrackingService.clearEvents();

      trackRetake('assessment-1', mockAssessment);

      const events = actionTrackingService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('retake_initiated');
    });

    it('should track helpful vote via convenience function', () => {
      actionTrackingService.clearEvents();

      trackHelpfulVote('assessment-1', mockAssessment, true);

      const events = actionTrackingService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('helpful_vote');
    });

    it('should track issue resolution via convenience function', () => {
      actionTrackingService.clearEvents();

      trackIssueResolution('assessment-1', mockAssessment, true);

      const events = actionTrackingService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].actionType).toBe('issue_resolved');
    });
  });
});
