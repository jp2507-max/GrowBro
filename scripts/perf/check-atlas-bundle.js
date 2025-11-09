#!/usr/bin/env node
/**
 * Analyze the latest Expo Atlas entry and enforce bundle budgets.
 *
 * Requirements:
 * - metro.config.js must be wrapped with `withExpoAtlas`.
 * - Run `npx expo export --platform <platform>` before executing this script
 *   so that `.expo/atlas.jsonl` contains fresh data.
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const platform = (process.env.BUNDLE_PLATFORM ?? 'android')
  .toLowerCase()
  .trim();
const atlasFile = path.resolve(
  process.env.ATLAS_FILE ?? path.join(process.cwd(), '.expo/atlas.jsonl')
);
const budgetKb = Number(process.env.BUNDLE_SIZE_BUDGET_KB ?? '3500');
const outputPath = path.resolve(
  process.env.BUNDLE_REPORT_OUTPUT ??
    path.join(process.cwd(), 'build', `bundle-report-${platform}.json`)
);

async function readAtlasEntries(filePath, targetPlatform) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Atlas file not found at ${filePath}`);
  }

  const entries = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const rawLine of rl) {
    lineNumber += 1;
    const line = rawLine.trim();
    if (!line || lineNumber === 1) continue;

    try {
      const entry = JSON.parse(line);
      const entryPlatform = String(entry[0] ?? '').toLowerCase();
      if (entryPlatform !== targetPlatform) continue;

      entries.push({
        entryPoint: entry[3],
        environment: entry[4],
        runtimeModules: entry[5] ?? [],
        modules: entry[6] ?? [],
      });
    } catch (error) {
      console.warn(
        `Skipping malformed Atlas entry on line ${lineNumber}`,
        error
      );
    }
  }

  return entries;
}

function formatKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

(async () => {
  try {
    const entries = await readAtlasEntries(atlasFile, platform);
    if (!entries.length) {
      throw new Error(
        `No Atlas bundles found for platform "${platform}". Did you run export?`
      );
    }

    const latest = entries[entries.length - 1];
    const modules = [...latest.runtimeModules, ...latest.modules];
    const totalBytes = modules.reduce(
      (sum, module) => sum + Number(module?.size ?? 0),
      0
    );
    const totalKb = formatKb(totalBytes);

    const topModules = modules
      .filter((module) => typeof module?.size === 'number')
      .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0))
      .slice(0, 10)
      .map((module) => ({
        package: module?.package ?? 'unknown',
        path: module?.relativePath ?? module?.absolutePath,
        sizeKb: formatKb(Number(module?.size ?? 0)),
      }));

    const summary = {
      platform,
      environment: latest.environment,
      entryPoint: latest.entryPoint,
      bundleSizeKb: totalKb,
      moduleCount: modules.length,
      topModules,
      generatedAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`Bundle summary saved to ${outputPath}`);

    if (totalKb > budgetKb) {
      console.error(
        `Bundle size ${totalKb}KB exceeded budget of ${budgetKb}KB. See ${outputPath} for details.`
      );
      process.exit(1);
    }

    console.log(
      `Bundle size ${totalKb}KB is within budget (${budgetKb}KB). Top offenders written to report.`
    );
  } catch (error) {
    console.error(error.message ?? error);
    process.exit(1);
  }
})();
