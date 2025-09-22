#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  resolveRepoRoot,
  createDraftFromInventory,
} = require('./lib/data-safety');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const repoRoot = resolveRepoRoot();
  const draft = createDraftFromInventory(repoRoot);
  const outDir = path.join(repoRoot, 'docs');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'data-safety-draft.json');
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2));
  console.log(`[data-safety:generate] Wrote ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error(`[data-safety:generate] FAIL: ${err.message}`);
  process.exit(1);
}
