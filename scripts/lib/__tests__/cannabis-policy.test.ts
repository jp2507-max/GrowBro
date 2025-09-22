const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  scanForCommerceLanguage,
  validateExternalLinks,
  runCannabisComplianceScan,
} = require('../cannabis-policy');

function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cannabis-scan-'));
  return dir;
}

function writeJson(filePath: string, data: any): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('cannabis-policy scanner utilities', () => {
  const config = {
    locales: {
      en: {
        denylist: ['buy', 'order'],
        allowlist: ['orderly'],
      },
    },
    globalDenylist: ['pickup'],
    globalAllowlist: ['pickup points'],
    blockedDomains: ['weedmaps.com'],
  };

  test('scanForCommerceLanguage detects blocked terms and respects allowlist', () => {
    const matches = scanForCommerceLanguage(
      'Growers should never buy or pickup products in the app.',
      'en',
      config
    );
    expect(matches).toHaveLength(2);
    const terms = matches.map((match) => match.term).sort();
    expect(terms).toEqual(['buy', 'pickup']);

    const allowed = scanForCommerceLanguage(
      'We discuss orderly nutrient pickup points in theory only.',
      'en',
      config
    );
    expect(allowed).toHaveLength(0);
  });

  test('validateExternalLinks flags blocked domains', () => {
    const violations = validateExternalLinks(
      ['https://weedmaps.com/menu/example'],
      config,
      { locale: 'en' }
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('links:blocked-domain');
  });
});

describe('runCannabisComplianceScan', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = createTempRepo();
  });

  afterEach(() => {
    if (repoRoot && fs.existsSync(repoRoot)) {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('detects translation and store listing violations', () => {
    const config = createTestConfig();
    const { translationFiles, storeListingFiles } = createViolatingFiles();

    writeJson(
      path.join(repoRoot, 'compliance', 'cannabis-policy.config.json'),
      config
    );
    writeJson(
      path.join(repoRoot, 'src', 'translations', 'en.json'),
      translationFiles.en
    );
    writeJson(
      path.join(repoRoot, 'docs', 'compliance', 'store-listing.en.json'),
      storeListingFiles.en
    );

    const report = runCannabisComplianceScan({ repoRoot });
    validateViolationReport(report);
  });

  test('passes when content is sanitized', () => {
    const config = createTestConfig();
    const { translationFiles, storeListingFiles } = createCleanFiles();

    writeJson(
      path.join(repoRoot, 'compliance', 'cannabis-policy.config.json'),
      config
    );
    writeJson(
      path.join(repoRoot, 'src', 'translations', 'en.json'),
      translationFiles.en
    );
    writeJson(
      path.join(repoRoot, 'docs', 'compliance', 'store-listing.en.json'),
      storeListingFiles.en
    );

    const report = runCannabisComplianceScan({ repoRoot });
    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
  });
});

// Helper functions to keep test functions under 70 lines
function createTestConfig() {
  return {
    locales: {
      en: {
        denylist: ['buy'],
        storeListingPath: 'docs/compliance/store-listing.en.json',
      },
    },
    translationLocales: ['en'],
    blockedDomains: ['weedmaps.com'],
  };
}

function createViolatingFiles() {
  return {
    translationFiles: {
      en: {
        common: {
          description: 'Do not buy anything through GrowBro.',
        },
      },
    },
    storeListingFiles: {
      en: {
        locale: 'en',
        shortDescription: 'Educational app without shopping.',
        externalLinks: ['https://weedmaps.com/example'],
      },
    },
  };
}

function createCleanFiles() {
  return {
    translationFiles: {
      en: {
        common: {
          description: 'GrowBro shares educational cultivation tips only.',
        },
      },
    },
    storeListingFiles: {
      en: {
        locale: 'en',
        shortDescription: 'Education and reminders without commerce.',
        externalLinks: ['https://growbro.app/privacy'],
      },
    },
  };
}

function validateViolationReport(report: any) {
  expect(report.ok).toBe(false);
  expect(report.totals.translations).toBe(1);
  expect(report.totals.storeListing).toBe(1);
  const ruleIds = report.violations.map((violation: any) => violation.ruleId);
  expect(ruleIds).toEqual(
    expect.arrayContaining(['commerce:buy', 'links:blocked-domain'])
  );
}
