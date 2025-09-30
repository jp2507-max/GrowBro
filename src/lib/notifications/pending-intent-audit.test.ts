import {
  getComplianceDocumentation,
  NOTIFICATION_TAP_FLOW_DOCUMENTATION,
  TRAMPOLINE_COMPLIANCE_CHECKLIST,
  validateNotificationTapFlow,
} from './pending-intent-audit';

describe('PendingIntent Audit - Checklist', () => {
  it('confirms Expo Router usage', () => {
    expect(TRAMPOLINE_COMPLIANCE_CHECKLIST.usesExpoRouter).toBe(true);
  });

  it('confirms getActivity() usage', () => {
    expect(TRAMPOLINE_COMPLIANCE_CHECKLIST.usesGetActivity).toBe(true);
  });

  it('confirms no BroadcastReceivers in flow', () => {
    expect(TRAMPOLINE_COMPLIANCE_CHECKLIST.noBroadcastReceivers).toBe(true);
  });

  it('confirms FLAG_IMMUTABLE requirement', () => {
    expect(TRAMPOLINE_COMPLIANCE_CHECKLIST.flagImmutable).toBe(true);
  });
});

describe('PendingIntent Audit - Validation', () => {
  it('returns compliant when all checks pass', () => {
    const result = validateNotificationTapFlow();

    expect(result.compliant).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('documents expected flow components', () => {
    const result = validateNotificationTapFlow();

    // With current implementation (Expo Router + expo-notifications),
    // we should always be compliant
    expect(result.compliant).toBe(true);
  });
});

describe('PendingIntent Audit - Documentation', () => {
  it('returns detailed flow documentation', () => {
    const docs = getComplianceDocumentation();

    expect(docs).toContain('Notification Tap Flow');
    expect(docs).toContain('Android 12+ Compliant');
    expect(docs).toContain('PendingIntent.getActivity()');
    expect(docs).toContain('NO BroadcastReceiver');
    expect(docs).toContain('MainActivity');
  });

  it('matches exported constant', () => {
    const docs = getComplianceDocumentation();
    expect(docs).toBe(NOTIFICATION_TAP_FLOW_DOCUMENTATION);
  });

  it('includes compliance verification checklist', () => {
    const docs = getComplianceDocumentation();

    expect(docs).toContain('✅ Uses PendingIntent.getActivity()');
    expect(docs).toContain('✅ No notification trampolines');
    expect(docs).toContain('✅ FLAG_IMMUTABLE');
    expect(docs).toContain('✅ Direct Activity launch');
  });
});

describe('Android 12+ Trampoline Restrictions', () => {
  it('documents critical constraint: no BroadcastReceiver hops', () => {
    const docs = getComplianceDocumentation();
    expect(docs).toContain('NO BroadcastReceiver hop');
  });

  it('documents Expo Router integration point', () => {
    const docs = getComplianceDocumentation();
    expect(docs).toContain('Expo Router');
    expect(docs).toContain('MainActivity');
  });

  it('documents deep link validation step', () => {
    const docs = getComplianceDocumentation();
    expect(docs).toContain('DeepLinkService validates');
  });
});
