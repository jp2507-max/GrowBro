function normalizeEnvFlagValue(value: unknown): string {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

export function isEnvFlagEnabled(key: string): boolean {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  if (!env) return false;

  const raw =
    env[key] ??
    (key.startsWith('EXPO_PUBLIC_')
      ? env[key.replace(/^EXPO_PUBLIC_/, '')]
      : undefined);
  const normalized = normalizeEnvFlagValue(raw);
  if (!normalized) return false;

  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}
