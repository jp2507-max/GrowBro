class SQLiteAdapterMock {
  constructor(config) {
    this.schema = config && config.schema ? config.schema : { tables: [] };
    this.migrations = config && config.migrations ? config.migrations : {};
    this.jsi = config && typeof config.jsi === 'boolean' ? config.jsi : false;
  }
  batch(_operations) {
    return Promise.resolve();
  }
}
module.exports = SQLiteAdapterMock;
