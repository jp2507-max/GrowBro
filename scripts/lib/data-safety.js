const fs = require('fs');
const path = require('path');

function readJson(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${p}`);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function resolveRepoRoot() {
  return path.resolve(__dirname, '..', '..');
}

function loadInventory(repoRoot) {
  const inv = readJson(
    path.join(repoRoot, 'compliance', 'data-inventory.json')
  );
  if (!Array.isArray(inv.items))
    throw new Error('data-inventory.json: items[] required');
  return inv.items;
}

function loadSdkIndex(repoRoot) {
  const idx = readJson(path.join(repoRoot, 'compliance', 'sdk-index.json'));
  if (!Array.isArray(idx.sdks))
    throw new Error('sdk-index.json: sdks[] required');
  return idx.sdks;
}

function loadPolicy(repoRoot) {
  return readJson(path.join(repoRoot, 'compliance', 'privacy-policy.json'));
}

function loadDeletionMethods(repoRoot) {
  const data = readJson(
    path.join(repoRoot, 'compliance', 'deletion-methods.json')
  );
  if (!Array.isArray(data.methods))
    throw new Error('deletion-methods.json: methods[] required');
  return data.methods;
}

function generateInventory(repoRoot) {
  const items = loadInventory(repoRoot);
  // Stamp generatedAt to aid diffing
  return items.map((it) => ({ ...it }));
}

function validateSdkDisclosuresWithSdkIndex(repoRoot) {
  const items = loadInventory(repoRoot);
  const sdks = loadSdkIndex(repoRoot);
  const bySdk = new Map(sdks.map((s) => [s.name, s]));
  const problems = [];
  for (const it of items) {
    if (it.sdkSource) {
      if (!bySdk.has(it.sdkSource)) {
        problems.push({
          type: 'unknown-sdk-source',
          sdkSource: it.sdkSource,
          message: `Unknown SDK source '${it.sdkSource}' referenced by data item`,
        });
        continue;
      }
      const sdk = bySdk.get(it.sdkSource);
      const declaredData = Array.isArray(sdk.declaredData)
        ? sdk.declaredData
        : [];
      if (!Array.isArray(sdk.declaredData)) {
        problems.push({
          type: 'invalid-sdk-declaredData',
          sdk: sdk.name,
          message: `SDK '${sdk.name}' has malformed declaredData (expected array, got ${typeof sdk.declaredData})`,
        });
      }
      if (!declaredData.includes(it.dataType)) {
        problems.push({
          type: 'sdk-declaration-mismatch',
          sdk: sdk.name,
          dataType: it.dataType,
          message: `Data type '${it.dataType}' not declared by SDK '${sdk.name}'`,
        });
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

function createDraftFromInventory(repoRoot) {
  const items = loadInventory(repoRoot);
  const deletionMethods = loadDeletionMethods(repoRoot);
  // Minimal Play Data Safety form shape for CI/artifact purposes
  const draft = {
    generatedAt: new Date().toISOString(),
    dataCollection: items.map((it) => ({
      feature: it.feature,
      dataType: it.dataType,
      purpose: it.purpose,
      retention: it.retention,
      sharedWith: it.sharedWith,
      sdkSource: it.sdkSource || null,
    })),
    accountDeletion: deletionMethods.map((method) => ({ ...method })),
  };
  return draft;
}

function syncWithPrivacyPolicy(repoRoot) {
  const draft = createDraftFromInventory(repoRoot);
  const policy = loadPolicy(repoRoot);
  const problems = [];
  const deletionMethods = draft.accountDeletion || [];
  const webMethod = deletionMethods.find((m) => m.type === 'web' && m.url);
  if (!webMethod) {
    problems.push({
      type: 'missing-web-deletion-method',
      message:
        'compliance/deletion-methods.json must include a web method with type "web" and url matching accountDeletionUrl',
    });
  }
  const inAppMethod = deletionMethods.find((m) => m.type === 'in_app');
  if (!inAppMethod) {
    problems.push({
      type: 'missing-in-app-deletion-method',
      message:
        'compliance/deletion-methods.json must include an in-app method describing discoverability (<=3 taps)',
    });
  }
  if (
    !policy.privacyPolicyUrl ||
    !/^https:\/\//.test(policy.privacyPolicyUrl)
  ) {
    problems.push({
      type: 'missing-privacy-policy-url',
      message:
        'privacy-policy.json must include a valid HTTPS privacyPolicyUrl',
    });
  }
  if (
    !policy.accountDeletionUrl ||
    !/^https:\/\//.test(policy.accountDeletionUrl)
  ) {
    problems.push({
      type: 'missing-deletion-url',
      message:
        'privacy-policy.json must include a valid HTTPS accountDeletionUrl',
    });
  }
  if (webMethod && webMethod.url && policy.accountDeletionUrl) {
    if (webMethod.url !== policy.accountDeletionUrl) {
      problems.push({
        type: 'deletion-url-mismatch',
        message: `Web deletion method url (${webMethod.url}) must match privacy-policy.json accountDeletionUrl (${policy.accountDeletionUrl})`,
      });
    }
  }
  // Very light sync check: ensure both URLs exist; deeper content sync is manual review.
  return {
    ok: problems.length === 0,
    problems,
    policy,
    draftSummaryCount: draft.dataCollection.length,
    accountDeletionSummary: deletionMethods.length,
  };
}

module.exports = {
  resolveRepoRoot,
  loadInventory,
  loadSdkIndex,
  loadPolicy,
  loadDeletionMethods,
  generateInventory,
  validateSdkDisclosuresWithSdkIndex,
  createDraftFromInventory,
  syncWithPrivacyPolicy,
};
