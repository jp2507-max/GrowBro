/**
 * Shared helpers for Digital Twin synchronization.
 */

/**
 * Triggers a fire-and-forget digital twin sync for a specific plant.
 * This is used to keep the digital twin state in sync after plant activities
 * or assessments without blocking the main UI thread.
 *
 * @param plantId The unique ID of the plant to sync
 * @param context A string identifying the caller for logging purposes
 */
export function triggerDigitalTwinSync(plantId: string, context: string): void {
  void import('@/lib/digital-twin')
    .then(({ DigitalTwinTaskEngine }) => {
      const engine = new DigitalTwinTaskEngine();
      return engine.syncForPlantId(plantId);
    })
    .catch((error) => {
      console.warn(`[${context}] digital twin sync failed`, error);
    });
}
