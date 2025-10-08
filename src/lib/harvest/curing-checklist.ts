/**
 * Curing Checklist Service (Stub)
 *
 * Validates curing quality checklist before inventory finalization.
 * TODO: Integrate with UI component in Task 6+ for user interaction.
 *
 * Requirements: A3 (checklist gating before finalization)
 */

/**
 * Curing checklist item
 */
export interface CuringChecklistItem {
  /** Unique identifier */
  id: string;

  /** Display label (i18n key) */
  label: string;

  /** Whether item is completed */
  completed: boolean;

  /** Optional description/guidance */
  description?: string;
}

/**
 * Minimum required checklist items for curing completion
 */
const REQUIRED_CHECKLIST_ITEMS: Omit<CuringChecklistItem, 'completed'>[] = [
  {
    id: 'aroma',
    label: 'harvest.curing_checklist.aroma',
    description: 'harvest.curing_checklist.aroma_description',
  },
  {
    id: 'stem_snap',
    label: 'harvest.curing_checklist.stem_snap',
    description: 'harvest.curing_checklist.stem_snap_description',
  },
  {
    id: 'jar_humidity',
    label: 'harvest.curing_checklist.jar_humidity',
    description: 'harvest.curing_checklist.jar_humidity_description',
  },
];

/**
 * Get curing checklist for a harvest
 *
 * TODO: Fetch from database once UI component is implemented.
 * For now, returns hardcoded checklist with all items uncompleted.
 *
 * @param _harvestId Harvest ID (unused in stub)
 * @returns Array of checklist items
 */
export async function getCuringChecklist(
  _harvestId: string
): Promise<CuringChecklistItem[]> {
  // Stub: return hardcoded checklist
  return REQUIRED_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    completed: false,
  }));
}

/**
 * Check if curing checklist is complete
 *
 * TODO: Query database once UI component stores checklist state.
 * For now, returns true (no blocking) to allow development.
 *
 * @param _harvestId Harvest ID (unused in stub)
 * @returns Whether all required items are completed
 */
export async function isCuringChecklistComplete(
  _harvestId: string
): Promise<boolean> {
  // Stub: always return true (no blocking yet)
  return true;
}

/**
 * Update curing checklist item completion status
 *
 * TODO: Persist to database once UI component is implemented.
 *
 * @param _harvestId Harvest ID (unused in stub)
 * @param _itemId Checklist item ID (unused in stub)
 * @param _completed Completion status (unused in stub)
 */
export async function updateChecklistItem(
  _harvestId: string,
  _itemId: string,
  _completed: boolean
): Promise<void> {
  // Stub: no-op
}
