#!/usr/bin/env node
/*
 Media usage audit — ensure photo/video pick flows route through src/lib/media/photo-access.ts.
 Fails if direct imports/usages of image pickers are detected outside the allowed wrapper.
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const REPORT_DIR = path.join(ROOT, 'build', 'reports', 'compliance');
const ALLOWED_WRAPPER = path.join(
  ROOT,
  'src',
  'lib',
  'media',
  'photo-access.ts'
);

const PATTERNS = [
  /from\s+['"]expo-image-picker['"];?/,
  /\bImagePicker\b/,
  /\blaunchImageLibrary\b/,
  /\blaunchCamera\b/,
  /from\s+['"]react-native-image-picker['"];?/,
  /from\s+['"]react-native-image-crop-picker['"];?/,
  /from\s+['"]expo-media-library['"];?/,
  /\bMediaLibrary\b/,
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      yield full;
    }
  }
}

function scanFile(filePath) {
  if (path.resolve(filePath) === path.resolve(ALLOWED_WRAPPER)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of PATTERNS) {
      if (re.test(line)) {
        hits.push({ line: i + 1, snippet: line.trim(), pattern: String(re) });
      }
    }
  }
  return hits;
}

function main() {
  ensureDir(REPORT_DIR);
  const violations = [];

  if (!fs.existsSync(SRC_DIR)) {
    const out = { ok: true, message: 'src directory not found; skipping.' };
    fs.writeFileSync(
      path.join(REPORT_DIR, 'media-usage-audit.json'),
      JSON.stringify(out, null, 2)
    );
    console.log('[media-usage-audit] SKIP — no src');
    return;
  }

  for (const file of walk(SRC_DIR)) {
    const hits = scanFile(file);
    if (hits.length) violations.push({ file: path.relative(ROOT, file), hits });
  }

  const ok = violations.length === 0;
  const report = {
    ok,
    policy:
      'Photos/Videos policy — prefer Android Photo Picker; route through src/lib/media/photo-access.ts',
    violations,
    guidance:
      'Remove direct imports/usages of image pickers. Create/extend abstractions in src/lib/media/photo-access.ts to centralize selection via platform Photo Picker / Selected Photos Access.',
  };
  const outPath = path.join(REPORT_DIR, 'media-usage-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  if (!ok) {
    console.error(
      '[media-usage-audit] FAIL — direct media picker usage detected'
    );
    violations.forEach((v) => {
      console.error(`- ${v.file}`);
      v.hits
        .slice(0, 3)
        .forEach((h) =>
          console.error(`  L${h.line}: ${h.snippet}  (${h.pattern})`)
        );
      if (v.hits.length > 3)
        console.error(`  ...and ${v.hits.length - 3} more`);
    });
    console.error('Report: ' + outPath);
    process.exit(1);
  }

  console.log('[media-usage-audit] OK');
  console.log('Report: ' + outPath);
}

try {
  main();
} catch (e) {
  console.error('[media-usage-audit] ERROR: ' + (e?.message || String(e)));
  process.exit(2);
}
