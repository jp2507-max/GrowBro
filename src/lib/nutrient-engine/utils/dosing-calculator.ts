/**
 * Dosing Calculator Utilities
 *
 * Pure functions for calculating stepwise EC corrections
 * with safety constraints and educational guidance.
 *
 * Requirements: 2.8
 */

/**
 * Calculate stepwise nutrient addition to adjust EC
 *
 * @param currentEc - Current EC reading (mS/cm @25°C)
 * @param targetEc - Target EC (mS/cm @25°C)
 * @param reservoirVolumeL - Reservoir volume in liters
 * @param stockConcentrationMlPerL - Stock nutrient concentration (ml/L)
 * @param maxStepPct - Maximum adjustment per step (default 10%)
 * @returns Dose guidance with safety notes
 */
// eslint-disable-next-line max-params, max-lines-per-function
export function calculateEcAdjustment(
  currentEc: number,
  targetEc: number,
  reservoirVolumeL: number,
  stockConcentrationMlPerL: number,
  maxStepPct: number = 0.1
): {
  steps: { stepNumber: number; addMl: number; resultingEc: number }[];
  safetyNotes: string[];
  totalMl: number;
} {
  // Validate inputs
  if (
    currentEc < 0 ||
    targetEc < 0 ||
    reservoirVolumeL <= 0 ||
    stockConcentrationMlPerL <= 0
  ) {
    throw new Error('Invalid input parameters for EC adjustment calculation');
  }

  // If already at or above target, no adjustment needed
  if (currentEc >= targetEc) {
    return {
      steps: [],
      safetyNotes: ['Current EC is already at or above target'],
      totalMl: 0,
    };
  }

  const maxStepEc = currentEc * maxStepPct;
  const steps: {
    stepNumber: number;
    addMl: number;
    resultingEc: number;
  }[] = [];
  const safetyNotes: string[] = [];

  let currentStepEc = currentEc;
  let stepNumber = 1;
  let totalMl = 0;

  // Educational safety notes
  safetyNotes.push('⚠️ This is educational guidance only, not product advice');
  safetyNotes.push('Always start with smaller doses than calculated');
  safetyNotes.push('Wait 15-30 minutes between additions to allow mixing');
  safetyNotes.push('Measure EC after each step before proceeding');

  // Calculate stepwise additions
  while (currentStepEc < targetEc && stepNumber <= 5) {
    // Maximum 5 steps for safety
    const remainingEc = targetEc - currentStepEc;
    const stepEc = Math.min(remainingEc, maxStepEc);

    // Simplified calculation: assume linear relationship
    // In reality, this varies by nutrient formulation
    const addMl = (stepEc / stockConcentrationMlPerL) * reservoirVolumeL;

    currentStepEc += stepEc;
    totalMl += addMl;

    steps.push({
      stepNumber,
      addMl: Math.round(addMl * 10) / 10, // Round to 1 decimal
      resultingEc: Math.round(currentStepEc * 100) / 100, // Round to 2 decimals
    });

    stepNumber++;
  }

  // Add specific warnings
  if (steps.length > 3) {
    safetyNotes.push(
      'Large adjustment requires multiple steps - consider dilution instead'
    );
  }

  if (totalMl > reservoirVolumeL * 0.02) {
    // More than 2% of reservoir volume
    safetyNotes.push(
      'Large volume addition may affect pH - check pH after adjustment'
    );
  }

  return { steps, safetyNotes, totalMl };
}

/**
 * Calculate dilution to reduce EC
 *
 * @param currentEc - Current EC reading (mS/cm @25°C)
 * @param targetEc - Target EC (mS/cm @25°C)
 * @param reservoirVolumeL - Reservoir volume in liters
 * @param maxDilutionPct - Maximum dilution percentage (default 20%)
 * @returns Dilution guidance
 */
// eslint-disable-next-line max-params
export function calculateDilution(
  currentEc: number,
  targetEc: number,
  reservoirVolumeL: number,
  maxDilutionPct: number = 0.2
): {
  removeL: number;
  addL: number;
  resultingEc: number;
  safetyNotes: string[];
} {
  // Validate inputs
  if (currentEc <= 0 || targetEc < 0 || reservoirVolumeL <= 0) {
    throw new Error('Invalid input parameters for dilution calculation');
  }

  // If already at or below target, no dilution needed
  if (currentEc <= targetEc) {
    return {
      removeL: 0,
      addL: 0,
      resultingEc: currentEc,
      safetyNotes: ['Current EC is already at or below target'],
    };
  }

  const dilutionRatio = targetEc / currentEc;
  const removeL = reservoirVolumeL * (1 - dilutionRatio);

  // Cap at max dilution percentage
  const maxRemoveL = reservoirVolumeL * maxDilutionPct;
  const actualRemoveL = Math.min(removeL, maxRemoveL);
  const actualAddL = actualRemoveL;

  // Calculate resulting EC
  const remainingVolume = reservoirVolumeL - actualRemoveL;
  const remainingEc = (currentEc * remainingVolume) / reservoirVolumeL;
  const resultingEc = remainingEc;

  const safetyNotes: string[] = [];
  safetyNotes.push('⚠️ This is educational guidance only, not product advice');
  safetyNotes.push('Remove solution from reservoir before adding fresh water');
  safetyNotes.push('Mix thoroughly after adding water');
  safetyNotes.push('Measure EC after dilution to verify');

  if (actualRemoveL < removeL) {
    safetyNotes.push(
      'Multiple dilution steps may be needed to reach target EC'
    );
  }

  return {
    removeL: Math.round(actualRemoveL * 10) / 10,
    addL: Math.round(actualAddL * 10) / 10,
    resultingEc: Math.round(resultingEc * 100) / 100,
    safetyNotes,
  };
}

/**
 * Format dosing step for display
 */
export function formatDosingStep(step: {
  stepNumber: number;
  addMl: number;
  resultingEc: number;
}): string {
  return `Step ${step.stepNumber}: Add ${step.addMl} ml → EC ${step.resultingEc} mS/cm`;
}

/**
 * Format dilution for display
 */
export function formatDilution(dilution: {
  removeL: number;
  addL: number;
  resultingEc: number;
}): string {
  return `Remove ${dilution.removeL} L, add ${dilution.addL} L fresh water → EC ${dilution.resultingEc} mS/cm`;
}
