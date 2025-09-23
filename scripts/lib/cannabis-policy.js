const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing JSON file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON at ${filePath}: ${(error && error.message) || 'unknown error'}`
    );
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function createSnippet(text, index, length) {
  const radius = 40;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function buildTermSet(values) {
  return new Set(
    toArray(values)
      .map((value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : ''
      )
      .filter((value) => value.length > 0)
  );
}

function scanForCommerceLanguage(text, locale, config) {
  if (typeof text !== 'string' || text.trim().length === 0) return [];

  const localeConfig = (config.locales && config.locales[locale]) || {};
  const denyTerms = new Set([
    ...buildTermSet(config.globalDenylist),
    ...buildTermSet(localeConfig.denylist),
  ]);
  const allowPhrases = new Set([
    ...buildTermSet(config.globalAllowlist),
    ...buildTermSet(localeConfig.allowlist),
  ]);

  if (denyTerms.size === 0) return [];

  const matches = [];
  for (const term of denyTerms) {
    const regex = new RegExp(
      `(?<!\\p{L})(${escapeRegExp(term)})(?!\\p{L})`,
      'giu'
    );
    let match;
    while ((match = regex.exec(text))) {
      const snippet = createSnippet(text, match.index, match[0].length);
      const snippetLower = snippet.toLowerCase();
      // To reduce false positives, consider a wider window around the term
      const windowRadius = 120;
      const start = Math.max(0, match.index - windowRadius);
      const end = Math.min(
        text.length,
        match.index + match[0].length + windowRadius
      );
      const windowLower = text.slice(start, end).toLowerCase();
      const isAllowed = Array.from(allowPhrases).some(
        (phrase) =>
          snippetLower.includes(phrase) || windowLower.includes(phrase)
      );
      if (isAllowed) continue;
      matches.push({
        ruleId: `commerce:${term}`,
        term,
        matchedText: match[0],
        index: match.index,
        snippet,
      });
    }
  }
  return matches;
}

function flattenStrings(node, ancestors = []) {
  const results = [];
  if (typeof node === 'string') {
    results.push({ path: ancestors.join('.'), value: node });
    return results;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      results.push(...flattenStrings(item, [...ancestors, String(index)]));
    });
    return results;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      results.push(...flattenStrings(value, [...ancestors, key]));
    }
  }
  return results;
}

function validateExternalLinks(links, config, context) {
  const blocked = buildTermSet(config.blockedDomains);
  const allowed = buildTermSet(config.allowedDomains);
  if (blocked.size === 0) return [];

  const violations = [];
  for (const link of links) {
    try {
      const url = new URL(link);
      const domain = url.hostname.toLowerCase();
      const base = domain.replace(/^www\./, '');
      if (allowed.has(domain) || allowed.has(base)) {
        continue;
      }
      if (blocked.has(domain) || blocked.has(base)) {
        violations.push({
          ruleId: 'links:blocked-domain',
          message: `Blocked domain detected: ${domain}`,
          url: link,
          context,
        });
      }
    } catch {
      violations.push({
        ruleId: 'links:invalid-url',
        message: 'Invalid URL encountered during compliance scan.',
        url: link,
        context,
      });
    }
  }
  return violations;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function loadConfig(repoRoot) {
  const configPath = path.join(
    repoRoot,
    'compliance',
    'cannabis-policy.config.json'
  );
  return readJson(configPath);
}

function scanTranslationFile(repoRoot, locale, config) {
  const filePath = path.join(repoRoot, 'src', 'translations', `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    return [
      {
        type: 'translation',
        locale,
        ruleId: 'translation:missing-file',
        message: `Translation file missing for locale ${locale}.`,
        filePath,
      },
    ];
  }

  const data = readJson(filePath);
  const entries = flattenStrings(data);
  const violations = [];
  for (const entry of entries) {
    const hits = scanForCommerceLanguage(entry.value, locale, config);
    for (const hit of hits) {
      violations.push({
        type: 'translation',
        locale,
        filePath,
        keyPath: entry.path,
        message: 'Commerce-related language detected in translation resources.',
        snippet: hit.snippet,
        term: hit.term,
        ruleId: hit.ruleId,
      });
    }
  }
  return violations;
}

function scanDocumentation(repoRoot, config) {
  const globs = toArray(config.documentationGlobs);
  if (globs.length === 0) return [];

  const violations = [];
  for (const descriptor of globs) {
    if (!descriptor || typeof descriptor.path !== 'string') continue;
    const baseDir = path.join(repoRoot, descriptor.path);
    if (!fs.existsSync(baseDir)) continue;
    const extensions = new Set(toArray(descriptor.extensions));

    walkDir(baseDir, (filePath) => {
      if (extensions.size > 0) {
        const ext = path.extname(filePath);
        if (!extensions.has(ext)) return;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const hits = scanForCommerceLanguage(raw, 'en', config);
      for (const hit of hits) {
        violations.push({
          type: 'documentation',
          filePath,
          locale: 'en',
          message: 'Commerce-related language detected in documentation.',
          snippet: hit.snippet,
          term: hit.term,
          ruleId: hit.ruleId,
        });
      }
    });
  }
  return violations;
}

function walkDir(dirPath, visitor) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkDir(fullPath, visitor);
    else visitor(fullPath);
  }
}

function scanStoreListing(repoRoot, locale, config) {
  const localeConfig = (config.locales && config.locales[locale]) || {};
  const storePath = localeConfig.storeListingPath
    ? path.join(repoRoot, localeConfig.storeListingPath)
    : undefined;
  if (!storePath) {
    return [
      {
        type: 'store-listing',
        locale,
        ruleId: 'store-listing:config-missing',
        message: `No store listing path configured for locale ${locale}.`,
      },
    ];
  }

  if (!fs.existsSync(storePath)) {
    return [
      {
        type: 'store-listing',
        locale,
        ruleId: 'store-listing:file-missing',
        message: `Store listing file missing for locale ${locale}.`,
        filePath: storePath,
      },
    ];
  }

  const data = readJson(storePath);
  const entries = flattenStrings(data);
  const violations = [];
  for (const entry of entries) {
    const hits = scanForCommerceLanguage(entry.value, locale, config);
    for (const hit of hits) {
      violations.push({
        type: 'store-listing',
        locale,
        filePath: storePath,
        keyPath: entry.path,
        message: 'Commerce-related language detected in store listing.',
        snippet: hit.snippet,
        term: hit.term,
        ruleId: hit.ruleId,
      });
    }
  }

  const links = Array.isArray(data.externalLinks) ? data.externalLinks : [];
  const linkViolations = validateExternalLinks(links, config, {
    locale,
    filePath: storePath,
  });
  linkViolations.forEach((violation) => {
    violations.push({
      type: 'store-listing',
      locale,
      filePath: storePath,
      message: violation.message,
      url: violation.url,
      ruleId: violation.ruleId,
    });
  });

  return violations;
}

function runCannabisComplianceScan({ repoRoot, config: providedConfig }) {
  const config = providedConfig || loadConfig(repoRoot);
  const translations = [];
  const locales = toArray(config.translationLocales);
  if (locales.length > 0) {
    for (const locale of locales) {
      translations.push(...scanTranslationFile(repoRoot, locale, config));
    }
  }

  const documentation = scanDocumentation(repoRoot, config);

  const storeListing = [];
  if (config.locales) {
    for (const locale of Object.keys(config.locales)) {
      storeListing.push(...scanStoreListing(repoRoot, locale, config));
    }
  }

  const violations = [...translations, ...documentation, ...storeListing];
  const report = {
    ok: violations.length === 0,
    scannedAt: new Date().toISOString(),
    totals: {
      translations: translations.length,
      documentation: documentation.length,
      storeListing: storeListing.length,
    },
    violations,
  };

  return report;
}

function generateMarkdownReport(report) {
  const lines = [];
  lines.push('# Cannabis Policy Compliance Report');
  lines.push('');
  lines.push(`Generated: ${report.scannedAt}`);
  lines.push(`Status: ${report.ok ? 'OK' : 'VIOLATIONS DETECTED'}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Translation violations: ${report.totals.translations}`);
  lines.push(`- Documentation violations: ${report.totals.documentation}`);
  lines.push(`- Store listing violations: ${report.totals.storeListing}`);
  lines.push('');

  if (report.violations.length === 0) {
    lines.push('No compliance issues detected.');
    return lines.join('\n');
  }

  lines.push('## Violations');
  lines.push('');
  report.violations.forEach((violation, index) => {
    lines.push(`### ${index + 1}. ${violation.ruleId}`);
    if (violation.message) lines.push(`- Message: ${violation.message}`);
    if (violation.locale) lines.push(`- Locale: ${violation.locale}`);
    if (violation.filePath) lines.push(`- File: ${violation.filePath}`);
    if (violation.keyPath) lines.push(`- Key: ${violation.keyPath}`);
    if (violation.url) lines.push(`- URL: ${violation.url}`);
    if (violation.snippet) lines.push(`- Snippet: \`${violation.snippet}\``);
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = {
  readJson,
  loadConfig,
  scanForCommerceLanguage,
  validateExternalLinks,
  scanTranslationFile,
  scanDocumentation,
  scanStoreListing,
  runCannabisComplianceScan,
  generateMarkdownReport,
  ensureDir,
};
