import { migrations } from '@/lib/watermelon-migrations';
import { schema } from '@/lib/watermelon-schema';

// Make slow hangs explicit in CI logs and fail faster than the default.
jest.setTimeout(10000);

console.log('[test-debug] watermelon-migrations test file loaded');

const getTableByName = (tables: any[], name: string) => {
  return tables.find((t) => t.name === name);
};

const getColumnByName = (columns: any[], name: string) => {
  return columns.find((c: any) => c.name === name);
};

const getMigrationByVersion = (version: number) => {
  return (migrations as any).migrations.find(
    (m: any) => m.toVersion === version
  );
};

const testOccurrenceOverridesTable = () => {
  it('exposes occurrence_overrides with deleted_at column in schema mock', () => {
    console.log('[test-debug] watermelon-migrations test started');
    const tables = (schema as any).tables as any[];
    const table = getTableByName(tables, 'occurrence_overrides');
    expect(table).toBeTruthy();
    expect(table.columns.some((c: any) => c.name === 'deleted_at')).toBe(true);
    console.log('[test-debug] watermelon-migrations test finished');
  });
};

const testSchemaVersion = () => {
  it('has schema version 6', () => {
    expect((schema as any).version).toBe(6);
  });
};

const testNutrientEngineTables = () => {
  it('includes all required Nutrient Engine tables in schema', () => {
    const tables = (schema as any).tables as any[];
    const tableNames = tables.map((t) => t.name);

    const nutrientEngineTables = [
      'ph_ec_readings',
      'deviation_alerts',
      'reservoirs',
      'source_water_profiles',
      'meters',
      'meter_calibrations',
      'feeding_schedules',
      'feeding_events',
      'correction_playbooks',
    ];

    nutrientEngineTables.forEach((tableName) => {
      expect(tableNames).toContain(tableName);
    });
  });
};

const testDataTypeConsistency = () => {
  it('has consistent data types between schema and migrations', () => {
    const tables = (schema as any).tables as any[];

    // Check source_water_profiles last_tested_at type
    const sourceWaterProfiles = getTableByName(tables, 'source_water_profiles');
    const lastTestedAtColumn = getColumnByName(
      sourceWaterProfiles.columns,
      'last_tested_at'
    );
    expect(lastTestedAtColumn.type).toBe('string');

    // Check server_revision types in existing tables
    const existingTables = ['series', 'tasks', 'occurrence_overrides'];
    existingTables.forEach((tableName) => {
      const table = getTableByName(tables, tableName);
      const serverRevisionColumn = getColumnByName(
        table.columns,
        'server_revision'
      );
      expect(serverRevisionColumn.type).toBe('number');
    });
  });
};

const testMigrationVersions = () => {
  it('has migrations up to version 6', () => {
    const migrationVersions = (migrations as any).migrations.map(
      (m: any) => m.toVersion
    );
    expect(migrationVersions).toContain(6);
    expect(Math.max(...migrationVersions)).toBe(6);
  });
};

const testVersion6Migration = () => {
  it('version 6 migration adds server sync columns to existing tables', () => {
    const version6Migration = getMigrationByVersion(6);
    expect(version6Migration).toBeTruthy();

    const steps = version6Migration.steps;
    // Detect addColumns steps by shape: they include a `table` string and a
    // `columns` array. Relying on `type === undefined` is brittle because
    // different migration builders may set or omit `type` differently.
    const addColumnSteps = steps.filter(
      (s: any) => Array.isArray(s.columns) && typeof s.table === 'string'
    );

    const targetTables = ['series', 'tasks', 'occurrence_overrides'];
    const affectedTables = addColumnSteps.map((s: any) => s.table);

    targetTables.forEach((tableName) => {
      expect(affectedTables).toContain(tableName);
    });

    // Verify each table gets the expected columns
    addColumnSteps.forEach((step: any) => {
      const columnNames = step.columns.map((c: any) => c.name);
      expect(columnNames).toContain('server_revision');
      expect(columnNames).toContain('server_updated_at_ms');

      // Verify server_revision column exists and represents a numeric type.
      // Migration column definitions typically include a `type: 'number'` but
      // be defensive: if `type` is present assert it's the string 'number',
      // otherwise if a default value exists ensure it's a number.
      const serverRevisionCol = getColumnByName(
        step.columns,
        'server_revision'
      );
      expect(serverRevisionCol).toBeTruthy();
      if (serverRevisionCol.type !== undefined) {
        expect(serverRevisionCol.type).toBe('number');
      } else {
        // Fallback: assert any provided default is numeric
        expect(
          Number.isInteger(serverRevisionCol.default) ||
            typeof serverRevisionCol.default === 'number'
        ).toBe(true);
      }
    });
  });
};

const testVersion5Migration = () => {
  it('version 5 migration creates all Nutrient Engine tables', () => {
    const version5Migration = getMigrationByVersion(5);
    expect(version5Migration).toBeTruthy();

    const steps = version5Migration.steps;
    const createTableSteps = steps.filter(
      (s: any) => s.type === 'create_table'
    );

    const expectedTables = [
      'ph_ec_readings',
      'deviation_alerts',
      'reservoirs',
      'source_water_profiles',
      'meters',
      'meter_calibrations',
      'feeding_schedules',
      'feeding_events',
      'correction_playbooks',
    ];

    const createdTables = createTableSteps.map((s: any) => s.schema.name);
    expectedTables.forEach((tableName) => {
      expect(createdTables).toContain(tableName);
    });
  });
};

describe('WatermelonDB migrations', () => {
  testOccurrenceOverridesTable();
  testSchemaVersion();
  testNutrientEngineTables();
  testDataTypeConsistency();
  testMigrationVersions();
  testVersion6Migration();
  testVersion5Migration();
});
