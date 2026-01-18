import { describe, expect, test } from '@jest/globals';

import { runSql } from '../unsafe-sql-utils';

describe('runSql error handling', () => {
  test('throws descriptive error for invalid table name', async () => {
    await expect(
      runSql('invalid_table', 'SELECT * FROM table')
    ).rejects.toThrow(
      'runSql: Unknown table "invalid_table". Valid tables are:'
    );
  });

  test('throws descriptive error for empty table name', async () => {
    await expect(runSql('', 'SELECT * FROM table')).rejects.toThrow(
      'runSql: Unknown table "". Valid tables are:'
    );
  });

  test('would accept valid table name (but will fail at database level)', async () => {
    // This should pass validation but fail at the database level since we don't have a real database
    // The error should be about the database connection, not table validation
    try {
      await runSql('plants', 'SELECT * FROM plants');
    } catch (error) {
      expect((error as Error).message).not.toContain('Unknown table');
      // Should be a database connection error instead
    }
  });
});
