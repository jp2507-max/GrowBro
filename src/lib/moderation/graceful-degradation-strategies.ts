/**
 * Degradation Strategies Configuration
 * Extracted to keep functions under line limits
 */

import type { DegradationStrategy, FeatureFlag } from './graceful-degradation';

export function createDegradationStrategies(): Map<
  FeatureFlag,
  DegradationStrategy
> {
  const strategies = new Map<FeatureFlag, DegradationStrategy>();

  strategies.set('transparency_reporting', {
    feature: 'transparency_reporting',
    isCritical: false,
    fallbackEnabled: true,
    fallbackImplementation: async () => ({ queued: true, submitted: false }),
    degradationMessage:
      'Transparency reporting temporarily unavailable. Reports will be queued.',
  });

  strategies.set('age_verification', {
    feature: 'age_verification',
    isCritical: true,
    fallbackEnabled: true,
    fallbackImplementation: async () => ({ verified: false, blocked: true }),
    degradationMessage:
      'Age verification temporarily unavailable. Access blocked.',
  });

  strategies.set('geo_restrictions', {
    feature: 'geo_restrictions',
    isCritical: false,
    fallbackEnabled: true,
    fallbackImplementation: async () => ({
      usedCache: true,
      restrictive: true,
    }),
    degradationMessage:
      'Geo-location service temporarily unavailable. Using cached data.',
  });

  strategies.set('trusted_flagger_analytics', {
    feature: 'trusted_flagger_analytics',
    isCritical: false,
    fallbackEnabled: false,
    degradationMessage: 'Trusted flagger analytics temporarily unavailable.',
  });

  strategies.set('ods_escalation', {
    feature: 'ods_escalation',
    isCritical: false,
    fallbackEnabled: true,
    fallbackImplementation: async () => ({ queued: true, escalated: false }),
    degradationMessage:
      'ODS escalation temporarily unavailable. Escalations queued.',
  });

  strategies.set('notification_delivery', {
    feature: 'notification_delivery',
    isCritical: false,
    fallbackEnabled: true,
    fallbackImplementation: async () => ({
      usedFallback: true,
      delivered: true,
    }),
    degradationMessage: 'Push notifications unavailable. Using email.',
  });

  strategies.set('audit_logging', {
    feature: 'audit_logging',
    isCritical: true,
    fallbackEnabled: true,
    fallbackImplementation: async () => ({
      usedLocalStorage: true,
      logged: true,
    }),
    degradationMessage: 'Audit database unavailable. Using local file system.',
  });

  strategies.set('sla_monitoring', {
    feature: 'sla_monitoring',
    isCritical: false,
    fallbackEnabled: false,
    degradationMessage: 'SLA monitoring temporarily unavailable.',
  });

  return strategies;
}
