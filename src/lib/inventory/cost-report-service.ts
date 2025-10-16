/**
 * Cost Report Service
 *
 * Generates comprehensive cost reports combining valuation, consumption
 * analytics, and harvest costs. Maintains minor currency unit integrity
 * throughout all calculations.
 *
 * Requirements:
 * - 9.5: Cost analysis showing supply costs over time (stacked by category)
 *        and cost per harvest with currency in minor units
 * - 9.6: Document when to use numeric for fractional cents or multi-currency
 */

import type { Database } from '@nozbe/watermelondb';

import {
  type CategoryCostSummary,
  getCategoryCostSummaries,
  getHarvestCostSummary,
  getTimeSerieCostData,
  type HarvestCostSummary,
  type TimeSerieCostData,
} from './cost-analysis-service';
import {
  getInventoryValuation,
  type InventoryValuation,
} from './inventory-valuation-service';

/**
 * Comprehensive cost report combining multiple dimensions
 */
export interface CostReport {
  /** Current inventory valuation snapshot */
  currentValuation: InventoryValuation;

  /** Consumption costs by category over the report period */
  consumptionByCategory: CategoryCostSummary[];

  /** Time-series cost data for trend analysis */
  timeSeries: TimeSerieCostData[];

  /** Report period */
  period: {
    startDate: Date;
    endDate: Date;
  };

  /** Report generation timestamp */
  generatedAt: Date;
}

/**
 * Harvest cost report
 */
export interface HarvestCostReport {
  /** Harvest task ID */
  taskId: string;

  /** Cost summary for this harvest */
  costSummary: HarvestCostSummary;

  /** Current inventory valuation (for context) */
  currentValuation: InventoryValuation;

  /** Report generation timestamp */
  generatedAt: Date;
}

/**
 * Generate comprehensive cost report for a time period
 *
 * Combines current inventory valuation with consumption analytics
 * to provide complete picture of inventory costs.
 *
 * @param database - WatermelonDB instance
 * @param options - Report period and bucket type
 * @returns Complete cost report
 *
 * @example
 * ```ts
 * const report = await generateCostReport(database, {
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31'),
 *   bucketType: 'month'
 * });
 *
 * console.log(`Current value: ${formatValue(report.currentValuation.totalValueMinor)}`);
 * console.log(`Consumed: ${formatValue(
 *   report.consumptionByCategory.reduce((sum, cat) => sum + cat.totalCostMinor, 0)
 * )}`);
 * ```
 */
export async function generateCostReport(
  database: Database,
  options: {
    startDate: Date;
    endDate: Date;
    bucketType: 'week' | 'month';
  }
): Promise<CostReport> {
  const { startDate, endDate, bucketType } = options;

  // Fetch all components in parallel
  const [currentValuation, consumptionByCategory, timeSeries] =
    await Promise.all([
      getInventoryValuation(database),
      getCategoryCostSummaries(database, { startDate, endDate }),
      getTimeSerieCostData(database, { bucketType, startDate, endDate }),
    ]);

  return {
    currentValuation,
    consumptionByCategory,
    timeSeries,
    period: { startDate, endDate },
    generatedAt: new Date(),
  };
}

/**
 * Generate harvest-specific cost report
 *
 * Combines harvest task costs with current inventory valuation
 * for complete picture of harvest economics.
 *
 * @param database - WatermelonDB instance
 * @param taskId - Harvest task ID
 * @returns Harvest cost report
 *
 * @example
 * ```ts
 * const report = await generateHarvestCostReport(database, taskId);
 *
 * console.log(`Harvest cost: ${formatValue(report.costSummary.totalCostMinor)}`);
 * console.log(`Items used: ${report.costSummary.items.length}`);
 * ```
 */
export async function generateHarvestCostReport(
  database: Database,
  taskId: string
): Promise<HarvestCostReport> {
  // Fetch harvest cost and current valuation in parallel
  const [costSummary, currentValuation] = await Promise.all([
    getHarvestCostSummary(database, taskId),
    getInventoryValuation(database),
  ]);

  return {
    taskId,
    costSummary,
    currentValuation,
    generatedAt: new Date(),
  };
}

/**
 * Currency Handling Patterns
 *
 * This system uses integer minor currency units (cents) throughout to avoid
 * floating-point precision issues. This works well for:
 *
 * - USD, EUR, GBP: 100 minor units = 1 major unit
 * - Items with whole-cent pricing
 * - Single-currency operations
 *
 * ## When to Switch to Decimal/Numeric Types
 *
 * Consider using DECIMAL/NUMERIC database types and BigDecimal in code when:
 *
 * 1. **Fractional Minor Units**: Currencies like BHD, KWD have 1000 minor units per major
 *    - Store as integer with 1000x multiplier, or use DECIMAL(12,3)
 *
 * 2. **Multi-Currency**: Different currencies have different minor unit scales
 *    - Store currency code alongside amount
 *    - Use DECIMAL to handle various precision levels
 *
 * 3. **High-Precision Calculations**: Scientific applications needing fractional cents
 *    - DECIMAL(15,4) or higher for sub-cent precision
 *
 * 4. **Bulk Calculations**: Large quantities causing integer overflow
 *    - JavaScript safe integers: ±2^53 (9 quadrillion)
 *    - If batch_qty * cost_per_unit_minor exceeds this, use BigInt or DECIMAL
 *
 * ## Implementation Notes
 *
 * Current system:
 * - Database: INTEGER columns for cost_per_unit_minor
 * - Code: number type (JavaScript safe integer range)
 * - Display: Division by 100 for dollar formatting
 *
 * To migrate to DECIMAL:
 * 1. Change columns to DECIMAL(12,2) for dollars/cents
 * 2. Update models to use string or BigDecimal types
 * 3. Add currency_code column if multi-currency
 * 4. Update formatValue/formatCost to handle various precision levels
 *
 * @see https://wiki.c2.com/?MoneyPattern
 * @see https://martinfowler.com/eaaCatalog/money.html
 */
export const CURRENCY_HANDLING_DOCS = {
  currentApproach: 'Integer minor units (cents) for USD/EUR/GBP',
  precision: '100 cents = $1.00',
  range: '±$90 trillion (JavaScript safe integer)',
  whenToUpgrade: [
    'Multi-currency support needed',
    'Fractional minor units (e.g., KWD with 1000 fils)',
    'Sub-cent precision required',
    'Calculation results exceed 2^53',
  ],
  migrationPath:
    'INTEGER → DECIMAL(12,2) + currency_code, number → string/BigDecimal',
} as const;
