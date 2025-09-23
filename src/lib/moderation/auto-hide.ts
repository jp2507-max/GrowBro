import { getItem, setItem } from '@/lib/storage';

import { enqueueForReview } from './review-queue';

type ReportStats = {
  // contentId -> count
  counts: Record<string, number>;
};

type HiddenMap = Record<
  string,
  { hiddenAt: number; reason: 'reports_threshold' }
>; // simple local hidden state

const REPORT_STATS_KEY = 'moderation.reportStats.v1';
const HIDDEN_MAP_KEY = 'moderation.hiddenMap.v1';

const DEFAULT_THRESHOLD = 3; // per spec: auto-hide at >=3 reports

function loadStats(): ReportStats {
  return getItem<ReportStats>(REPORT_STATS_KEY) ?? { counts: {} };
}

function saveStats(stats: ReportStats): void {
  setItem(REPORT_STATS_KEY, stats);
}

function loadHidden(): HiddenMap {
  return getItem<HiddenMap>(HIDDEN_MAP_KEY) ?? {};
}

function saveHidden(map: HiddenMap): void {
  setItem(HIDDEN_MAP_KEY, map);
}

export function getReportCount(contentId: string | number): number {
  const stats = loadStats();
  return stats.counts[String(contentId)] ?? 0;
}

export function isHidden(contentId: string | number): boolean {
  const map = loadHidden();
  return Boolean(map[String(contentId)]);
}

export function incrementReportAndMaybeHide(
  contentId: string | number,
  { threshold = DEFAULT_THRESHOLD }: { threshold?: number } = {}
): { count: number; hidden: boolean } {
  const id = String(contentId);
  const stats = loadStats();
  const next = (stats.counts[id] ?? 0) + 1;
  stats.counts[id] = next;
  saveStats(stats);

  let hidden = false;
  if (next >= threshold) {
    const hiddenMap = loadHidden();
    if (!hiddenMap[id]) {
      hiddenMap[id] = {
        hiddenAt: Date.now(),
        reason: 'reports_threshold',
      } as const;
      saveHidden(hiddenMap);
      hidden = true;
      enqueueForReview(contentId, next);
    }
  }
  return { count: next, hidden };
}

export function unhide(contentId: string | number): void {
  const id = String(contentId);
  const hiddenMap = loadHidden();
  if (hiddenMap[id]) {
    delete hiddenMap[id];
    saveHidden(hiddenMap);
  }
}
