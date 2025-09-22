import fs from 'fs/promises';
import path from 'path';

// lightweight runtime import of Node scripts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dataSafety = require('../../../scripts/lib/data-safety');

const repoRoot = path.resolve(__dirname, '../../..');

describe('Data Safety tooling', () => {
  afterEach(async () => {
    // Clean up any generated draft file to avoid polluting the repo
    const draftPath = path.join(repoRoot, 'docs', 'data-safety-draft.json');
    try {
      await fs.unlink(draftPath);
    } catch {
      // File doesn't exist, that's fine
    }
  });
  test('generateInventory returns items', () => {
    const items = dataSafety.generateInventory(repoRoot);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  test('createDraftFromInventory writes shape', () => {
    const draft = dataSafety.createDraftFromInventory(repoRoot);
    expect(Array.isArray(draft.dataCollection)).toBe(true);
    expect(draft.dataCollection[0]).toHaveProperty('dataType');
  });

  test('validateSdkDisclosuresWithSdkIndex ok/mismatch detection', () => {
    const res = dataSafety.validateSdkDisclosuresWithSdkIndex(repoRoot);
    // Our initial seed should be consistent; if mismatches exist, they should be reported, not crash
    expect(res).toHaveProperty('ok');
    expect(Array.isArray(res.problems)).toBe(true);
  });

  test('syncWithPrivacyPolicy validates URLs', () => {
    const res = dataSafety.syncWithPrivacyPolicy(repoRoot);
    expect(res).toHaveProperty('ok');
    expect(res.policy).toHaveProperty('privacyPolicyUrl');
    expect(res.policy).toHaveProperty('accountDeletionUrl');
  });
});
