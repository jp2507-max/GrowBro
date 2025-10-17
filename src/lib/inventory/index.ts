/**
 * Inventory Module Exports
 *
 * Automatic inventory deduction system with FEFO picking and FIFO costing.
 */

// Core deduction service
export * from './deduction-service';

// Batch picking with FEFO ordering
export * from './batch-picker';

// Deduction map validation
export * from './deduction-validators';

// Quantity scaling calculations
export * from './scaling-calculator';

// Insufficient stock handling
export * from './insufficient-stock-handler';

// Consumption history queries
export * from './consumption-history';

// Cost analysis and tracking
export * from './cost-analysis-service';
export * from './harvest-cost-calculator';

// Inventory valuation (real-time value calculation)
export * from './inventory-valuation-service';
export * from './use-inventory-valuation';

// Cost reports (comprehensive reporting)
export * from './cost-report-service';

// Analytics hooks
export * from './use-consumption-analytics';

// CSV import/export
export * from './csv-export-service';
export * from './csv-import-service';
export * from './csv-parser';

// Telemetry (Requirement 11.1, 11.2)
export * from './telemetry';
export * from './telemetry-types';
