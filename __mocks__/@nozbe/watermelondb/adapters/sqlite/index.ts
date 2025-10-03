type SQLiteAdapterConfig = {
  schema: {
    tables: any[];
  };
  migrations?: Record<string, any>;
  jsi?: boolean;
};

class SQLiteAdapterMock {
  schema: { tables: any[] };
  migrations: Record<string, any>;
  jsi: boolean;

  constructor(config: SQLiteAdapterConfig) {
    this.schema = config.schema || { tables: [] };
    this.migrations = config.migrations || {};
    this.jsi = typeof config.jsi === 'boolean' ? config.jsi : false;
  }

  batch(_operations: any[]): Promise<void> {
    return Promise.resolve();
  }

  unsafeExecuteSql(_sql: string): Promise<void> {
    return Promise.resolve();
  }
}

export default SQLiteAdapterMock;
