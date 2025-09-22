// Simple, deterministic spam heuristics for reports

const MIN_REASON_LENGTH = 3;
const REPETITIVE_CHAR_REPEAT_THRESHOLD = 5;
const LINK_COUNT_THRESHOLD = 2;
const MAX_SHORT_LINK_REASON_LENGTH = 60;
const DUPLICATE_COUNT_THRESHOLD = 3;

export type SpamVerdict = 'allow' | 'suspicious' | 'deny';

export type SpamContext = {
  reason: string;
  // number of previous reports by same user on same content within a short time
  duplicateCount?: number;
};

export function detectSpam(ctx: SpamContext): SpamVerdict {
  const r = (ctx.reason || '').trim().toLowerCase();
  if (!r) return 'deny';
  if (r.length < MIN_REASON_LENGTH) return 'deny';
  // basic repetitive character heuristic
  if (RegExp(`(.)\\1{${REPETITIVE_CHAR_REPEAT_THRESHOLD},}`).test(r))
    return 'suspicious';
  // URL only or mostly links
  const linkMatches = r.match(/https?:\/\//g);
  if (
    linkMatches &&
    linkMatches.length >= LINK_COUNT_THRESHOLD &&
    r.length < MAX_SHORT_LINK_REASON_LENGTH
  )
    return 'suspicious';
  if ((ctx.duplicateCount ?? 0) >= DUPLICATE_COUNT_THRESHOLD)
    return 'suspicious';
  return 'allow';
}
