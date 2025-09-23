/*
  Tests for scripts/lib/cannabis-policy.js
  - scanForCommerceLanguage: detects commerce terms; respects allowlist phrases (wider window)
  - validateExternalLinks: flags blocked domains; ignores allowed; handles invalid URLs
*/

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  scanForCommerceLanguage,
  validateExternalLinks,
  runCannabisComplianceScan,
} = require('../cannabis-policy');

type LocaleCfg = {
  denylist: string[];
  allowlist?: string[];
};

type TestConfig = {
  locales: Record<string, LocaleCfg>;
  globalDenylist?: string[];
  globalAllowlist?: string[];
  blockedDomains?: string[];
};

const baseConfig: TestConfig = {
  locales: {
    en: {
      denylist: ['buy', 'sell', 'order', 'pickup', 'delivery', 'shop'],
      allowlist: [
        'does not facilitate sales, vendor links, pickup, or delivery',
        'never provides shopping, ordering, pickup, or delivery',
        'educational only',
      ],
    },
    de: {
      denylist: [
        'kaufen',
        'verkaufen',
        'bestellen',
        'lieferung',
        'abholung',
        'geschaeft',
        'geschäft',
        'versand',
      ],
      allowlist: [
        'unterstuetzt weder verkauf noch anbieter-links, abholung oder lieferung',
        'keine einkaufs-, abhol- oder lieferfunktionen',
        'nur bildung',
        'reine bildungsinhalte',
      ],
    },
  },
  globalDenylist: [],
  globalAllowlist: [],
  blockedDomains: ['weedmaps.com', 'leafly.com'],
};

describe('cannabis-policy scanner: language', () => {
  test('detects commerce verbs in plain marketing copy (en)', () => {
    const text = 'Grow with confidence and buy the best tools for your plants.';
    const hits = scanForCommerceLanguage(text, 'en', baseConfig);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h: any) => h.term === 'buy')).toBe(true);
  });

  test('does not flag educational disclaimers that negate commerce (en)', () => {
    const text =
      'GrowBro does not facilitate sales, vendor links, pickup, or delivery. All features are educational only.';
    const hits = scanForCommerceLanguage(text, 'en', baseConfig);
    expect(hits).toHaveLength(0);
  });

  test('does not flag educational disclaimers that negate commerce (de)', () => {
    const text =
      'GrowBro unterstuetzt weder Verkauf noch Anbieter-Links, Abholung oder Lieferung. Alle Funktionen bleiben bildungsorientiert.';
    const hits = scanForCommerceLanguage(text, 'de', baseConfig);
    expect(hits).toHaveLength(0);
  });

  test('respects allowlist when phrase is near the match window', () => {
    const text = `
      This paragraph explains our policy in depth. 
      GrowBro does not facilitate sales, vendor links, pickup, or delivery. 
      Users sometimes mention the word delivery casually in feedback, but we clearly avoid it.
    `;
    const hits = scanForCommerceLanguage(text, 'en', baseConfig);
    expect(hits).toHaveLength(0);
  });
});

describe('cannabis-policy scanner: links', () => {
  test('flags blocked vendor domains', () => {
    const links = ['https://weedmaps.com/shop/xyz'];
    const out = validateExternalLinks(links, baseConfig, { locale: 'en' });
    expect(out.some((v: any) => v.ruleId === 'links:blocked-domain')).toBe(
      true
    );
  });

  test('ignores allowed domains', () => {
    const links = ['https://growbro.app/privacy'];
    const out = validateExternalLinks(links, baseConfig, { locale: 'en' });
    expect(out).toHaveLength(0);
  });

  test('handles invalid URLs', () => {
    const links = ['not-a-url'];
    const out = validateExternalLinks(links, baseConfig, { locale: 'en' });
    expect(out.some((v: any) => v.ruleId === 'links:invalid-url')).toBe(true);
  });

  test('allowedDomains overrides blockedDomains', () => {
    const cfg = {
      ...baseConfig,
      blockedDomains: ['growbro.app'],
      allowedDomains: ['growbro.app'],
    } as any;
    const out = validateExternalLinks(['https://growbro.app/privacy'], cfg, {
      locale: 'en',
    });
    expect(out).toHaveLength(0);
  });
});

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
    const terms = matches.map((match: { term: string }) => match.term).sort();
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
