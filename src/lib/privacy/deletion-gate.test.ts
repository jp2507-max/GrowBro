import { Env } from '@env';
import fs from 'fs';
import path from 'path';

import {
  provideWebDeletionUrl,
  validateDeletionPathAccessibility,
} from '@/lib/privacy/deletion-manager';

type DeletionMethod = {
  type: string;
  url?: string;
};

type DeletionMethodsFile = {
  methods: DeletionMethod[];
};

function parseDeletionMethods(json: string): DeletionMethodsFile {
  const payload = JSON.parse(json) as unknown;
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as { methods?: unknown }).methods)
  ) {
    throw new Error('Invalid deletion methods file');
  }
  return payload as DeletionMethodsFile;
}

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
    const methods = parseDeletionMethods(
      fs.readFileSync(deletionMethodsPath, 'utf8')
    );
    const webMethod = methods.methods.find((m) => m.type === 'web');
    expect(webMethod).toBeTruthy();
    expect(webMethod?.url).toBe(url);
  });
});
