#!/usr/bin/env node
/*
 Generates docs/review-notes-ios.md for App Store Review.
 - Pulls demo login env var names from compliance/app-access.json
 - Uses privacy and deletion URLs from compliance/privacy-policy.json
 - Includes age gate, UGC safeguards, permissions summary, and key deep links

 References (verify periodically):
 - https://developer.apple.com/app-store/review/guidelines/
 - https://developer.apple.com/support/offering-account-deletion-in-your-app/
 - https://developer.apple.com/documentation/bundleresources/privacy-manifest-files/
 - https://developer.apple.com/documentation/photosui/phpickerviewcontroller
 - https://developer.apple.com/documentation/apptrackingtransparency
*/
const fs = require('fs');
const path = require('path');

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  const root = process.cwd();
  const appAccessPath = path.join(root, 'compliance', 'app-access.json');
  const privacyPath = path.join(root, 'compliance', 'privacy-policy.json');

  const appAccess = readJsonSafe(appAccessPath) || {};
  const privacy = readJsonSafe(privacyPath) || {};

  const usernameEnv =
    appAccess?.credentials?.usernameEnv || 'APP_ACCESS_REVIEWER_EMAIL';
  const passwordEnv =
    appAccess?.credentials?.passwordEnv || 'APP_ACCESS_REVIEWER_PASSWORD';
  const features = Array.isArray(appAccess?.features) ? appAccess.features : [];
  const privacyPolicyUrl =
    privacy?.privacyPolicyUrl || 'https://growbro.app/privacy';
  const accountDeletionUrl =
    privacy?.accountDeletionUrl || 'https://growbro.app/delete-account';

  const now = new Date().toISOString();

  // Compose deep link bullets from app-access.json
  const deepLinksSection = features
    .map((f) => {
      const lines = [];
      lines.push(`- ${f.title}:`);
      if (Array.isArray(f.deepLinks) && f.deepLinks.length) {
        for (const link of f.deepLinks) lines.push(`  - ${link}`);
      }
      return lines.join('\n');
    })
    .join('\n');

  const content = `# iOS Reviewer Notes (GrowBro)\n\nGenerated: ${now}\n\n> Purpose: Provide App Review with quick verification notes — demo login, age-gate, UGC safeguards, permissions, and account deletion. GrowBro is an educational app for home cannabis cultivation (no commerce).\n\n## Test Account / Access\n\n- Request credentials via App Access or use environment variables during test builds:\n  - Username env: \`${usernameEnv}\`\n  - Password env: \`${passwordEnv}\`\n- The reviewer flow and deep links are documented below.\n\n## Age Gate (18+)\n\n- App requires users to confirm they are 18+ before proceeding.\n- Rationale: educational cannabis content; no shopping, ordering, pickup, or delivery features.\n- Flow: Age confirmation is shown on first launch; adults proceed, underage users are blocked.\n\n## Core Features\n\n- Calendar & Task Reminders: Works fully even if notifications are denied (reminders still visible in-app).\n- AI Photo Assessment: Optional; photos captured for plant diagnosis guidance.\n- Community Feed: User-generated posts; moderation controls described below.\n- Harvest Workflow: Track drying/curing and inventory (no sales).\n\n## UGC Safeguards (Report / Mute / Block)\n\n- Long-press or overflow menu on posts exposes moderation actions:\n  - Report: Submit a report; content is auto-hidden at a threshold of multiple reports.\n  - Mute: Hide another user's content from the feed.\n  - Block: Prevent interaction from a specific user.\n- Pinned feed post is pre-moderated for safe review.\n- Content sharing is opt-in; photos are private by default.\n\n## Permissions (iOS)\n\n- Camera: Capture plant photos for AI assessment.\n- Photos: Uses the iOS photo picker (PHPicker) to select images — no full photo library permission is requested.\n- Notifications: Optional; used for local task reminders. App remains usable with permission denied.\n- Tracking: Not used; no ATT prompt; no IDFA/AdSupport references.\n- Privacy Manifests: Repository includes privacy manifest and CI validation.\n\nPrivacy policy: ${privacyPolicyUrl}\n\n## Account Deletion (≤ 3 taps)\n\n- In-app path: Settings → Privacy & Data → Delete Account (≤ 3 taps).\n- Behavior: Deletes account and data; signs out.\n- Web deletion fallback: ${accountDeletionUrl}\n\n## Useful Deep Links for Review\n\n${deepLinksSection || '- (No deep links defined)'}\n\n## Contact\n\n- Support: ${privacyPolicyUrl}\n- Notes: If any feature requires clarification during review, we can temporarily disable Community/AI features via remote flags and provide a focused reviewer build.\n`;

  const outDir = path.join(root, 'docs');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'review-notes-ios.md');
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`[review-notes] Wrote ${path.relative(root, outPath)}`);
}

try {
  main();
} catch (e) {
  console.error('[review-notes] ERROR:', e?.message || String(e));
  process.exit(1);
}
