import { getItem, setItem } from '@/lib/storage';

export type AuditAction =
  | 'retention-delete'
  | 'retention-aggregate'
  | 'retention-anonymize';

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

function simpleHash(input: string): string {
  // Lightweight deterministic hash (FNV-1a 32-bit in hex) to avoid native deps in tests
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function getAuditLog(): AuditEntry[] {
  return getItem<AuditEntry[]>(AUDIT_KEY) ?? [];
}

export function appendAudit(
  entry: Omit<AuditEntry, 'id' | 't' | 'prevHash' | 'hash'>
): AuditEntry {
  const existing = getAuditLog();
  const prevHash =
    existing.length > 0 ? existing[existing.length - 1]!.hash : '0';
  const t = Date.now();
  const id = String(existing.length + 1);
  const base = { ...entry, id, t, prevHash } as Omit<AuditEntry, 'hash'>;
  const hash = simpleHash(JSON.stringify(base));
  const full: AuditEntry = { ...base, hash };
  setItem(AUDIT_KEY, [...existing, full]);
  return full;
}

export function validateAuditChain(): boolean {
  const list = getAuditLog();
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

export function exportAuditLogJson(): string {
  return JSON.stringify(getAuditLog(), null, 2);
}
