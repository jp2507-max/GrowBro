import {
  getSecureConfig,
  setSecureConfig,
} from '@/lib/privacy/secure-config-store';

export type AuditAction =
  | 'retention-delete'
  | 'retention-aggregate'
  | 'retention-anonymize'
  | 'account-delete-request'
  | 'consent-block';

export type AuditEntry = {
  id: string;
  t: number; // ms epoch
  action: AuditAction;
  dataType?: string;
  count?: number;
  bucket?: string; // e.g., YYYY-MM-DD for aggregates
  details?: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

const AUDIT_KEY = 'privacy.audit.v1';

let auditCache: AuditEntry[] | null = null;

async function ensureAuditCache(): Promise<AuditEntry[]> {
  if (auditCache) return auditCache;
  const stored = await getSecureConfig<AuditEntry[]>(AUDIT_KEY);
  auditCache = Array.isArray(stored) ? stored : [];
  return auditCache;
}

function simpleHash(input: string): string {
  // Lightweight deterministic hash (FNV-1a 32-bit in hex) to avoid native deps in tests
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const current = await ensureAuditCache();
  return [...current];
}

export async function appendAudit(
  entry: Omit<AuditEntry, 'id' | 't' | 'prevHash' | 'hash'>
): Promise<AuditEntry> {
  const existing = await ensureAuditCache();
  const prevHash =
    existing.length > 0 ? existing[existing.length - 1]!.hash : '0';
  const t = Date.now();
  const id = String(existing.length + 1);
  const base = { ...entry, id, t, prevHash } as Omit<AuditEntry, 'hash'>;
  const hash = simpleHash(JSON.stringify(base));
  const full: AuditEntry = { ...base, hash };
  const next = [...existing, full];
  auditCache = next;
  await setSecureConfig(AUDIT_KEY, next);
  return full;
}

export async function validateAuditChain(): Promise<boolean> {
  const list = await ensureAuditCache();
  let prev = '0';
  for (const e of list) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev) return false;
    const recomputed = simpleHash(JSON.stringify(rest));
    if (hash !== recomputed) return false;
    prev = hash;
  }
  return true;
}

export async function exportAuditLogJson(): Promise<string> {
  const list = await ensureAuditCache();
  return JSON.stringify(list, null, 2);
}
