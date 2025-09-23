#!/usr/bin/env node
const { resolveRepoRoot, loadPolicy } = require('./lib/data-safety');

function main() {
  const repoRoot = resolveRepoRoot();
  const policy = loadPolicy(repoRoot);
  const problems = [];
  if (
    !policy.privacyPolicyUrl ||
    !/^https?:\/\//.test(policy.privacyPolicyUrl)
  ) {
    problems.push('Missing or invalid privacyPolicyUrl');
  }
  if (
    !policy.accountDeletionUrl ||
    !/^https?:\/\//.test(policy.accountDeletionUrl)
  ) {
    problems.push('Missing or invalid accountDeletionUrl');
  }
  if (problems.length) {
    console.error(
      '[privacy-policy:validate] FAIL:\n- ' + problems.join('\n- ')
    );
    process.exit(1);
  }
  console.log('[privacy-policy:validate] OK');
}

try {
  main();
} catch (err) {
  console.error(`[privacy-policy:validate] FAIL: ${err.message}`);
  process.exit(1);
}
