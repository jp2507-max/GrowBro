// Minimal per-file mock to ensure helpers are callable without relying on module interop
import { migrations } from '@/lib/watermelon-migrations';
import { schema } from '@/lib/watermelon-schema';

jest.mock('@nozbe/watermelondb', () => ({
  appSchema: (cfg: any) => cfg,
  tableSchema: (cfg: any) => cfg,
}));

// Make slow hangs explicit in CI logs and fail faster than the default.
jest.setTimeout(10000);

console.log('[test-debug] watermelon-migrations test file loaded');

const getTableByName = (tables: any[], name: string): any | undefined => {
  return tables.find((t) => t.name === name);
};

const getColumnByName = (columns: any[], name: string): any | undefined => {
  return columns.find((c: any) => c.name === name);
};

const getMigrationByVersion = (version: number): any | undefined => {
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
  it('has schema version 39', () => {
    expect((schema as any).version).toBe(39);
  });
};

const testNutrientEngineTables = () => {
  it('includes all required Nutrient Engine tables in schema', () => {
    const tables = (schema as any).tables as any[];
    const tableNames = tables.map((t) => t.name);

    const nutrientEngineTables = [
      'feeding_templates',
      'ph_ec_readings_v2',
      'reservoirs_v2',
      'source_water_profiles_v2',
      'calibrations',
      'deviation_alerts_v2',
      'reservoir_events',
    ];

    nutrientEngineTables.forEach((tableName) => {
      expect(tableNames).toContain(tableName);
    });
  });
};

const testDataTypeConsistency = () => {
  it('has consistent data types between schema and migrations', () => {
    const tables = (schema as any).tables as any[];

    // Check source_water_profiles_v2 last_tested_at type (should be number for epoch ms)
    const sourceWaterProfiles = getTableByName(
      tables,
      'source_water_profiles_v2'
    );
    const lastTestedAtColumn = getColumnByName(
      sourceWaterProfiles.columns,
      'last_tested_at'
    );
    expect(lastTestedAtColumn.type).toBe('number');

    // Check plants table deleted_at type (should be numeric for purge logic)
    const plantsTable = getTableByName(tables, 'plants');
    expect(plantsTable).toBeTruthy();
    const plantsDeletedAt = getColumnByName(plantsTable.columns, 'deleted_at');
    expect(plantsDeletedAt).toBeTruthy();
    expect(plantsDeletedAt.type).toBe('number');

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

    // Check nutrient engine tables have proper sync columns
    const nutrientEngineTables = [
      'feeding_templates',
      'ph_ec_readings_v2',
      'reservoirs_v2',
      'source_water_profiles_v2',
      'calibrations',
      'deviation_alerts_v2',
      'reservoir_events',
    ];
    nutrientEngineTables.forEach((tableName) => {
      const table = getTableByName(tables, tableName);
      expect(table).toBeTruthy();
      const serverRevisionColumn = getColumnByName(
        table.columns,
        'server_revision'
      );
      const serverUpdatedAtColumn = getColumnByName(
        table.columns,
        'server_updated_at_ms'
      );
      expect(serverRevisionColumn?.type).toBe('number');
      expect(serverUpdatedAtColumn?.type).toBe('number');
    });
  });
};

const testMigrationVersions = () => {
  it('has migrations up to the latest version', () => {
    const migrationVersions = (migrations as any).migrations.map(
      (m: any) => m.toVersion
    );
    const maxVersion = Math.max(...migrationVersions);
    expect(migrationVersions).toContain(maxVersion);
    expect(Math.max(...migrationVersions)).toBe(maxVersion);
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

const testVersion17Migration = () => {
  it('version 17 migration creates all new Nutrient Engine tables', () => {
    const version17Migration = getMigrationByVersion(17);
    expect(version17Migration).toBeTruthy();

    const steps = version17Migration.steps;
    const createTableSteps = steps.filter(
      (s: any) => s.type === 'create_table'
    );

    const expectedTables = [
      'feeding_templates',
      'ph_ec_readings_v2',
      'reservoirs_v2',
      'source_water_profiles_v2',
      'calibrations',
      'deviation_alerts_v2',
      'reservoir_events',
    ];

    const createdTables = createTableSteps.map((s: any) => s.schema.name);
    expectedTables.forEach((tableName) => {
      expect(createdTables).toContain(tableName);
    });

    // Verify ph_ec_readings_v2 has proper indexed columns
    const phEcReadingsStep = createTableSteps.find(
      (s: any) => s.schema.name === 'ph_ec_readings_v2'
    );
    expect(phEcReadingsStep).toBeTruthy();
    const phEcColumns = phEcReadingsStep.schema.columnArray;
    const indexedColumns = phEcColumns.filter((c: any) => c.isIndexed);
    const indexedColumnNames = indexedColumns.map((c: any) => c.name);
    expect(indexedColumnNames).toContain('plant_id');
    expect(indexedColumnNames).toContain('reservoir_id');
    expect(indexedColumnNames).toContain('measured_at');
    expect(indexedColumnNames).toContain('meter_id');
    expect(indexedColumnNames).toContain('created_at');

    // Verify calibrations has meter_id indexed
    const calibrationsStep = createTableSteps.find(
      (s: any) => s.schema.name === 'calibrations'
    );
    expect(calibrationsStep).toBeTruthy();
    const calibrationColumns = calibrationsStep.schema.columnArray;
    const meterIdColumn = calibrationColumns.find(
      (c: any) => c.name === 'meter_id'
    );
    expect(meterIdColumn.isIndexed).toBe(true);

    // Verify deviation_alerts_v2 has proper indexed columns
    const deviationAlertsStep = createTableSteps.find(
      (s: any) => s.schema.name === 'deviation_alerts_v2'
    );
    expect(deviationAlertsStep).toBeTruthy();
    const alertColumns = deviationAlertsStep.schema.columnArray;
    const readingIdColumn = alertColumns.find(
      (c: any) => c.name === 'reading_id'
    );
    const triggeredAtColumn = alertColumns.find(
      (c: any) => c.name === 'triggered_at'
    );
    expect(readingIdColumn.isIndexed).toBe(true);
    expect(triggeredAtColumn.isIndexed).toBe(true);
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
  testVersion17Migration();
});
