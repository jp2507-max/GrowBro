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
