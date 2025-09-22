import fs from 'fs';
import path from 'path';

import { Env } from '@/lib/env';
import {
  provideWebDeletionUrl,
  validateDeletionPathAccessibility,
} from '@/lib/privacy/deletion-manager';

jest.mock('@/lib/env', () => ({
  Env: {
    ACCOUNT_DELETION_URL: 'https://growbro.app/delete-account',
  },
}));

describe('Deletion compliance gate', () => {
  test('in-app deletion flow remains <=3 taps', () => {
    const result = validateDeletionPathAccessibility();
    expect(result.accessible).toBe(true);
    expect(result.stepCount).toBeLessThanOrEqual(result.maxAllowed);
  });

  test('web deletion URL matches compliance artifacts', () => {
    const url = provideWebDeletionUrl();
    expect(url).toBe(Env.ACCOUNT_DELETION_URL);

    const deletionMethodsPath = path.resolve(
      __dirname,
      '../../..',
      'compliance',
      'deletion-methods.json'
    );
    const methods = JSON.parse(fs.readFileSync(deletionMethodsPath, 'utf8'));
    const webMethod = Array.isArray(methods.methods)
      ? methods.methods.find((m: any) => m.type === 'web')
      : undefined;
    expect(webMethod).toBeTruthy();
    expect(webMethod?.url).toBe(url);
  });
});
