import { Env } from '@env';

import { DeepLinkValidator } from '@/lib/deep-link-validator';

const REQUIRED_FEATURES = ['assessment', 'community', 'reminders'] as const;

export type RequiredFeature = (typeof REQUIRED_FEATURES)[number];

export type MaskedSecret = {
  envKey: string;
  masked: string;
  present: boolean;
};

export type TestCredentials = {
  username: MaskedSecret;
  password: MaskedSecret;
  delivery: 'play-console' | 'ci-secret';
  notes: string[];
  valid: boolean;
};

export type DemoFlowStep = {
  id: string;
  feature: RequiredFeature;
  title: string;
  description: string;
  checklist: string[];
  deepLink: string;
};

export type DemoFlowInstructions = {
  prerequisites: string[];
  steps: DemoFlowStep[];
};

export type AccessValidationIssue = {
  feature: RequiredFeature | 'credentials';
  reason: string;
};

export type AccessValidationResult = {
  ok: boolean;
  issues: AccessValidationIssue[];
};

export type ReviewerGuide = {
  testCredentials: TestCredentials;
  stepsToReachAssessment: string[];
  stepsToReachCommunity: string[];
  stepsToReachReminders: string[];
  deepLinkEntryPoints: string[];
  internalChecklist: string[];
};

const DEEP_LINKS: Record<RequiredFeature, { scheme: string; https: string }> = {
  assessment: {
    scheme: 'growbro://app-access/assessment-overview',
    https: 'https://growbro.app/app-access/assessment-overview',
  },
  community: {
    scheme: 'growbro://feed',
    https: 'https://growbro.app/feed',
  },
  reminders: {
    scheme: 'growbro://calendar',
    https: 'https://growbro.app/calendar',
  },
};

function maskSecret(value: string | undefined, envKey: string): MaskedSecret {
  if (!value) {
    return {
      envKey,
      masked: '<unset>',
      present: false,
    };
  }

  if (value.includes('@')) {
    const [user, domain] = value.split('@');
    const visible = user.slice(0, 2);
    const maskedUser = `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}`;
    return {
      envKey,
      masked: `${maskedUser}@${domain}`,
      present: true,
    };
  }

  return {
    envKey,
    masked: `${'*'.repeat(Math.min(value.length, 8))} (env:${envKey})`,
    present: true,
  };
}

export function provideTestCredentials(): TestCredentials {
  // Only read sensitive credentials in development mode to prevent secret leakage
  // In production builds, these values are never exposed to the client bundle
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // In non-production builds, try to read from EXPO_PUBLIC_* first (for backward compatibility)
    // In production, these won't be exposed, so fall back to direct env access
    const emailFromPublic = Env.EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL;
    const passwordFromPublic = Env.EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD;

    const email = emailFromPublic || Env.APP_ACCESS_REVIEWER_EMAIL;
    const password = passwordFromPublic || Env.APP_ACCESS_REVIEWER_PASSWORD;

    const username = maskSecret(
      email,
      emailFromPublic
        ? 'EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL'
        : 'APP_ACCESS_REVIEWER_EMAIL'
    );
    const passwordMasked = maskSecret(
      password,
      passwordFromPublic
        ? 'EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD'
        : 'APP_ACCESS_REVIEWER_PASSWORD'
    );

    return {
      username,
      password: passwordMasked,
      delivery: 'play-console',
      notes: [
        'Credentials live in Play Console > App content > App access.',
        'Rotate reviewer account after every release cycle.',
        'Update CI secret references when credentials change.',
      ],
      valid: username.present && passwordMasked.present,
    };
  }

  // In production builds, never expose credentials to prevent secret leakage
  return {
    username: maskSecret(undefined, 'APP_ACCESS_REVIEWER_EMAIL'),
    password: maskSecret(undefined, 'APP_ACCESS_REVIEWER_PASSWORD'),
    delivery: 'play-console',
    notes: [
      'Credentials are managed securely in production builds.',
      'Contact development team for reviewer access setup.',
    ],
    valid: false,
  };
}

function createAssessmentSteps(): DemoFlowStep[] {
  return [
    {
      id: 'assessment-01',
      feature: 'assessment',
      title: 'Access AI assessment history',
      description:
        'Login with reviewer account, accept the age gate, then open the Insights tab to view sample assessments.',
      checklist: [
        'Launch GrowBro with reviewer credentials.',
        'On age gate prompt choose "I am over 18".',
        'Tap Insights -> AI Assessment.',
        'Open the "Sample Leaf Analysis" card to view results.',
      ],
      deepLink: DEEP_LINKS.assessment.scheme,
    },
    {
      id: 'assessment-02',
      feature: 'assessment',
      title: 'Trigger guided assessment demo',
      description:
        'Use the preloaded demo plant to trigger the sample guided assessment walkthrough.',
      checklist: [
        'From AI Assessment, tap "Run guided assessment".',
        'Select the demo plant "Aurora Borealis".',
        'Choose the sample gallery image to simulate capture.',
        'Review the generated guidance summary.',
      ],
      deepLink: DEEP_LINKS.assessment.https,
    },
  ];
}

function createCommunitySteps(): DemoFlowStep[] {
  return [
    {
      id: 'community-01',
      feature: 'community',
      title: 'Reach community feed',
      description:
        'Navigate to the community feed showing pre-moderated demo posts.',
      checklist: [
        'Tap Community from the bottom navigation bar.',
        'Scroll to the "Compliance launch checklist" pinned post.',
        'Open the actions menu to verify moderation options are visible.',
      ],
      deepLink: DEEP_LINKS.community.scheme,
    },
    {
      id: 'community-02',
      feature: 'community',
      title: 'Access sample report flow',
      description:
        'Demonstrate content moderation by opening the actions menu on a seeded post.',
      checklist: [
        'Within pinned post, tap the three dot menu.',
        'Show Report / Mute / Block options.',
        'Cancel to return to the feed.',
      ],
      deepLink: DEEP_LINKS.community.https,
    },
  ];
}

function createRemindersSteps(): DemoFlowStep[] {
  return [
    {
      id: 'reminders-01',
      feature: 'reminders',
      title: 'Review scheduled reminders',
      description:
        'Open the calendar view to highlight automated reminders for the current grow cycle.',
      checklist: [
        'Tap Calendar from navigation.',
        "Select today's date to show the scheduled feeding task.",
        'Open reminder details to display notification status.',
      ],
      deepLink: DEEP_LINKS.reminders.scheme,
    },
    {
      id: 'reminders-02',
      feature: 'reminders',
      title: 'Demonstrate reminder notification settings',
      description:
        'Show reminder management to confirm notifications are configurable.',
      checklist: [
        'In Calendar, tap the reminder settings icon.',
        'Adjust default reminder lead time.',
        'Save to confirm update and note expected push behavior.',
      ],
      deepLink: DEEP_LINKS.reminders.https,
    },
  ];
}

export function generateDemoFlow(): DemoFlowInstructions {
  const prerequisites = [
    'Ensure reviewer credentials are active and not locked by MFA.',
    'Seed the demo account with a grow log, one assessment sample, and scheduled reminders.',
    'Confirm age gate override token is configured for reviewer account.',
  ];

  const steps: DemoFlowStep[] = [
    ...createAssessmentSteps(),
    ...createCommunitySteps(),
    ...createRemindersSteps(),
  ];

  return { prerequisites, steps };
}

export function validateAccessToGatedFeatures(): AccessValidationResult {
  const issues: AccessValidationIssue[] = [];
  const credentials = provideTestCredentials();
  if (!credentials.valid) {
    issues.push({
      feature: 'credentials',
      reason: 'Reviewer credentials missing',
    });
  }

  const { steps } = generateDemoFlow();
  for (const feature of REQUIRED_FEATURES) {
    const featureSteps = steps.filter((step) => step.feature === feature);
    if (featureSteps.length === 0) {
      issues.push({ feature, reason: 'No reviewer instructions supplied' });
      continue;
    }

    for (const step of featureSteps) {
      if (!validateDeepLink(step.deepLink)) {
        issues.push({ feature, reason: `Invalid deep link: ${step.deepLink}` });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function createReviewerInstructions(): ReviewerGuide {
  const credentials = provideTestCredentials();
  const demoFlow = generateDemoFlow();
  const deepLinks = new Set<string>();

  for (const entry of Object.values(DEEP_LINKS)) {
    deepLinks.add(entry.scheme);
    deepLinks.add(entry.https);
  }

  return {
    testCredentials: credentials,
    stepsToReachAssessment: collectSteps(demoFlow, 'assessment'),
    stepsToReachCommunity: collectSteps(demoFlow, 'community'),
    stepsToReachReminders: collectSteps(demoFlow, 'reminders'),
    deepLinkEntryPoints: Array.from(deepLinks),
    internalChecklist: [
      'Upload reviewer credentials to Play Console App access section.',
      'Verify demo account data reset before submission.',
      'Confirm deep links resolve via DeepLinkValidator.',
      'Attach reviewer walkthrough (PDF) to compliance package.',
    ],
  };
}

function collectSteps(
  demoFlow: DemoFlowInstructions,
  feature: RequiredFeature
): string[] {
  return demoFlow.steps
    .filter((step) => step.feature === feature)
    .flatMap((step) => [step.title, ...step.checklist]);
}

function validateDeepLink(link: string): boolean {
  const validator = new DeepLinkValidator();
  if (link.startsWith('growbro://')) {
    return validator.validateURL(link);
  }

  if (link.startsWith('https://')) {
    return validator.validateURL(link);
  }

  return false;
}

export const AppAccessManager = {
  provideTestCredentials,
  generateDemoFlow,
  validateAccessToGatedFeatures,
  createReviewerInstructions,
};
