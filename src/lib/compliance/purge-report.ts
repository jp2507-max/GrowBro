export type PurgeReport = {
  generatedAt: string; // ISO date
  items: {
    dataType: string;
    purgedCount: number;
  }[];
};

export function assertPurgeReportFresh(
  report: PurgeReport,
  maxAgeHours = 48
): void {
  const t = Date.parse(report.generatedAt);
  if (Number.isNaN(t)) throw new Error('Invalid purge report timestamp');
  const ageMs = Date.now() - t;
  if (ageMs > maxAgeHours * 3600 * 1000) {
    throw new Error('PurgeReport is stale');
  }
}
