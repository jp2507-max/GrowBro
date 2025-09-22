// Simple, deterministic spam heuristics for reports

export type SpamVerdict = 'allow' | 'suspicious' | 'deny';

export type SpamContext = {
  reason: string;
  // number of previous reports by same user on same content within a short time
  duplicateCount?: number;
};

export function detectSpam(ctx: SpamContext): SpamVerdict {
  const r = (ctx.reason || '').trim().toLowerCase();
  if (!r) return 'deny';
  if (r.length < 3) return 'suspicious';
  // basic repetitive character heuristic
  if (/(.)\1{5,}/.test(r)) return 'suspicious';
  // URL only or mostly links
  const linkMatches = r.match(/https?:\/\//g);
  if (linkMatches && linkMatches.length >= 2 && r.length < 60)
    return 'suspicious';
  if ((ctx.duplicateCount ?? 0) >= 3) return 'suspicious';
  return 'allow';
}
