'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  getColorTokens,
  spacingScale,
} = require('./design-tokens/token-metadata');

const projectRoot = path.resolve(__dirname, '..');
const srcDirectory = path.resolve(projectRoot, 'src');
const reportsDirectory = path.resolve(projectRoot, 'build/reports');

const spacingClassPrefixes = [
  'm',
  'mt',
  'mr',
  'mb',
  'ml',
  'mx',
  'my',
  'p',
  'pt',
  'pr',
  'pb',
  'pl',
  'px',
  'py',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
];

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildColorTokenMatchers(tokens) {
  return tokens.map((token) => ({
    token: token.token,
    hex: token.hex,
    test: new RegExp(`\\b${escapeForRegex(token.token)}\\b`, 'g'),
  }));
}

function buildSpacingTokenMatchers(tokens) {
  return tokens.map((token) => ({
    token: token.token,
    value: token.value,
    tests: spacingClassPrefixes.map(
      (prefix) =>
        new RegExp(
          `\\b${escapeForRegex(prefix)}-${escapeForRegex(token.token)}\\b`,
          'g'
        )
    ),
  }));
}

function gatherSourceFiles(rootDirectory) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        continue;
      }

      files.push(entryPath);
    }
  }

  walk(rootDirectory);
  return files;
}

function analyzeTokens(content, matchers) {
  const used = new Set();
  for (const matcher of matchers) {
    matcher.test.lastIndex = 0;
    if (matcher.test.test(content)) {
      used.add(matcher.token);
    }
  }

  return used;
}

function analyzeSpacingTokens(content, matchers) {
  const used = new Set();
  for (const matcher of matchers) {
    if (
      matcher.tests.some((regex) => {
        regex.lastIndex = 0;
        return regex.test(content);
      })
    ) {
      used.add(matcher.token);
    }
  }

  return used;
}

function collectUsage(files, colorMatchers, spacingMatchers) {
  const usedColorTokens = new Set();
  const usedSpacingTokens = new Set();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    for (const token of analyzeTokens(content, colorMatchers)) {
      usedColorTokens.add(token);
    }

    for (const token of analyzeSpacingTokens(content, spacingMatchers)) {
      usedSpacingTokens.add(token);
    }
  }

  return { usedColorTokens, usedSpacingTokens };
}

function buildCoverage(colorTokens, spacingTokens, usage) {
  const colorCoverage = colorTokens.map((token) => ({
    token: token.token,
    hex: token.hex,
    used: usage.usedColorTokens.has(token.token),
  }));

  const spacingCoverage = spacingTokens.map((token) => ({
    token: token.token,
    value: token.value,
    used: usage.usedSpacingTokens.has(token.token),
  }));

  return {
    colorCoverage,
    spacingCoverage,
  };
}

function summarizeCoverage(colorCoverage, spacingCoverage, filesAnalyzed) {
  const colors = {
    total: colorCoverage.length,
    used: colorCoverage.filter((token) => token.used).length,
  };
  const spacing = {
    total: spacingCoverage.length,
    used: spacingCoverage.filter((token) => token.used).length,
  };

  return {
    colors,
    spacing,
    filesAnalyzed,
  };
}

function coveragePercentage(used, total) {
  if (!total) {
    return 0;
  }

  return Number(((used / total) * 100).toFixed(2));
}

function buildJsonReport(summary, colorCoverage, spacingCoverage) {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      colors: {
        ...summary.colors,
        coverage: coveragePercentage(summary.colors.used, summary.colors.total),
      },
      spacing: {
        ...summary.spacing,
        coverage: coveragePercentage(
          summary.spacing.used,
          summary.spacing.total
        ),
      },
    },
    colorTokens: colorCoverage,
    spacingTokens: spacingCoverage,
    dontUseExamples: [
      {
        title: 'Hard-coded hex color',
        snippet: "<View style={{ backgroundColor: '#123456' }} />",
        recommendation:
          'Use colors from src/components/ui/colors.js or Tailwind class tokens.',
      },
      {
        title: 'Pixel spacing literal',
        snippet: '<View style={{ marginTop: 12 }} />',
        recommendation:
          'Use Tailwind spacing tokens such as mt-3 or theme spacing utilities.',
      },
    ],
  };
}

function buildMarkdownReport({
  jsonReport,
  summary,
  colorCoverage,
  spacingCoverage,
}) {
  return [
    '# Design Token Coverage Report',
    '',
    `Generated at: ${jsonReport.generatedAt}`,
    '',
    '## Colors',
    '',
    `Coverage: ${summary.colors.used}/${summary.colors.total} (${jsonReport.summary.colors.coverage}%)`,
    '',
    '| Token | Hex | Used |',
    '| --- | --- | --- |',
    ...colorCoverage.map((token) => {
      return `| ${token.token} | ${token.hex ?? 'N/A'} | ${
        token.used ? '✅' : '⚠️'
      } |`;
    }),
    '',
    '## Spacing',
    '',
    `Coverage: ${summary.spacing.used}/${summary.spacing.total} (${jsonReport.summary.spacing.coverage}%)`,
    '',
    '| Token | Value | Used |',
    '| --- | --- | --- |',
    ...spacingCoverage.map((token) => {
      return `| ${token.token} | ${token.value} | ${
        token.used ? '✅' : '⚠️'
      } |`;
    }),
    '',
    "## Don't Use Examples",
    '',
    ...jsonReport.dontUseExamples.flatMap((example) => [
      `- **${example.title}**`,
      '  ```tsx',
      `  ${example.snippet}`,
      '  ```',
      `  ${example.recommendation}`,
      '',
    ]),
  ];
}

function writeReports(jsonReport, markdownLines) {
  fs.mkdirSync(reportsDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDirectory, 'design-token-coverage.json'),
    JSON.stringify(jsonReport, null, 2)
  );
  fs.writeFileSync(
    path.join(reportsDirectory, 'design-token-coverage.md'),
    markdownLines.join('\n')
  );
}

function logSummary(summary) {
  console.log(
    `Design token coverage report generated with ${summary.colors.used}/${summary.colors.total} color tokens in use.`
  );
  console.log(
    `Spacing coverage: ${summary.spacing.used}/${summary.spacing.total} tokens found across ${summary.filesAnalyzed} files.`
  );
}

function generateCoverageReport() {
  const files = gatherSourceFiles(srcDirectory);
  const colorTokens = getColorTokens();
  const spacingTokens = spacingScale;
  const colorMatchers = buildColorTokenMatchers(colorTokens);
  const spacingMatchers = buildSpacingTokenMatchers(spacingTokens);
  const usage = collectUsage(files, colorMatchers, spacingMatchers);
  const { colorCoverage, spacingCoverage } = buildCoverage(
    colorTokens,
    spacingTokens,
    usage
  );
  const summary = summarizeCoverage(
    colorCoverage,
    spacingCoverage,
    files.length
  );
  const jsonReport = buildJsonReport(summary, colorCoverage, spacingCoverage);
  const markdownLines = buildMarkdownReport({
    jsonReport,
    summary,
    colorCoverage,
    spacingCoverage,
  });

  writeReports(jsonReport, markdownLines);
  logSummary(summary);
}

if (require.main === module) {
  generateCoverageReport();
}

module.exports = {
  generateCoverageReport,
};
