#!/usr/bin/env node
/*
 Simple CI scanner for Android manifest compliance.
 - Flags restricted permissions: QUERY_ALL_PACKAGES, MANAGE_EXTERNAL_STORAGE
 - Flags exact alarm permissions: SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM
 - Exits non-zero if violations found, emitting a JSON report to build/reports/compliance/
*/
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readManifest() {
  // Prefer prebuild output under android/app/src/main/AndroidManifest.xml if native project exists
  const candidates = [
    path.join(
      process.cwd(),
      'android',
      'app',
      'src',
      'main',
      'AndroidManifest.xml'
    ),
    // Expo prebuild cache (may not exist locally in managed-only runs)
    path.join(process.cwd(), 'dist', 'android', 'AndroidManifest.xml'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p))
      return { path: p, content: fs.readFileSync(p, 'utf8') };
  }
  return { path: null, content: '' };
}

function scan(content) {
  const violations = [];
  const add = (ruleId, match, message) =>
    violations.push({ ruleId, matchedText: match, message });

  const checks = [
    {
      id: 'restricted:QUERY_ALL_PACKAGES',
      re: /android\.permission\.QUERY_ALL_PACKAGES/g,
      msg: 'QUERY_ALL_PACKAGES is restricted. Use <queries> for specific intents.',
    },
    {
      id: 'restricted:MANAGE_EXTERNAL_STORAGE',
      re: /android\.permission\.MANAGE_EXTERNAL_STORAGE/g,
      msg: 'MANAGE_EXTERNAL_STORAGE (all-files-access) is not allowed.',
    },
    {
      id: 'exact:SCHEDULE_EXACT_ALARM',
      re: /android\.permission\.SCHEDULE_EXACT_ALARM/g,
      msg: 'Exact alarm permission requires Play Console declaration and justification.',
    },
    {
      id: 'exact:USE_EXACT_ALARM',
      re: /android\.permission\.USE_EXACT_ALARM/g,
      msg: 'Exact alarm permission requires Play Console declaration and justification.',
    },
    {
      id: 'media:READ_MEDIA_IMAGES',
      re: /android\.permission\.READ_MEDIA_IMAGES/g,
      msg: 'READ_MEDIA_IMAGES present — ensure Photo Picker is preferred; require local justification.',
    },
    {
      id: 'media:READ_MEDIA_VIDEO',
      re: /android\.permission\.READ_MEDIA_VIDEO/g,
      msg: 'READ_MEDIA_VIDEO present — ensure Photo Picker is preferred; require local justification.',
    },
    {
      id: 'media:READ_MEDIA_VISUAL_USER_SELECTED',
      re: /android\.permission\.READ_MEDIA_VISUAL_USER_SELECTED/g,
      msg: 'Selected Photos Access in use — OK when paired with reselection UI.',
    },
  ];

  for (const c of checks) {
    let m;
    while ((m = c.re.exec(content))) add(c.id, m[0], c.msg);
  }
  return violations;
}

function main() {
  const { path: manifestPath, content } = readManifest();
  const reportDir = path.join(process.cwd(), 'build', 'reports', 'compliance');
  ensureDir(reportDir);

  if (!manifestPath) {
    const msg =
      'AndroidManifest.xml not found. Run "pnpm prebuild" before scanning.';
    fs.writeFileSync(
      path.join(reportDir, 'android-manifest-scan.json'),
      JSON.stringify({ ok: false, error: msg }, null, 2)
    );
    console.error(msg);
    process.exit(2);
  }

  const violations = scan(content);

  // Additional gating: if exact alarm permissions appear, require justification doc
  const requiresJustification = violations.some((v) =>
    v.ruleId.startsWith('exact:')
  );
  const requiresMediaJustification = violations.some((v) =>
    v.ruleId.startsWith('media:READ_MEDIA_')
  );
  // eslint-disable-next-line prettier/prettier
  const justificationPaths = [path.join(process.cwd(), 'compliance', 'play-exact-alarm-declaration.md'), path.join(process.cwd(), 'compliance', 'media-permissions-justification.md')];
  if (requiresJustification && !fs.existsSync(justificationPaths[0])) {
    violations.push({
      ruleId: 'exact:JUSTIFICATION_MISSING',
      matchedText: 'N/A',
      message:
        'Exact alarm permission detected but justification file missing: compliance/play-exact-alarm-declaration.md',
    });
  }
  if (requiresMediaJustification && !fs.existsSync(justificationPaths[1])) {
    violations.push({
      ruleId: 'media:JUSTIFICATION_MISSING',
      matchedText: 'N/A',
      message:
        'READ_MEDIA_* permission detected but justification file missing: compliance/media-permissions-justification.md',
    });
  }
  const report = {
    ok: violations.length === 0,
    manifestPath,
    violations,
  };
  const outPath = path.join(reportDir, 'android-manifest-scan.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  if (!report.ok) {
    console.error(`Compliance violations detected. See ${outPath}`);
    violations.forEach((v) => console.error(`- [${v.ruleId}] ${v.message}`));
    process.exit(1);
  }
  console.log(`Manifest compliance OK. Report at ${outPath}`);
}

main();
