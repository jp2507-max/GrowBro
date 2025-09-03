import { DateTime } from 'luxon';

function toIcsDateTimeLocal(localIso: string, tzid: string): string {
  const dt = DateTime.fromISO(localIso, { zone: tzid });
  return dt.toFormat("yyyyLLdd'T'HHmmss");
}

function toIcsDateTimeUtc(utcIso: string): string {
  const dt = DateTime.fromISO(utcIso, { zone: 'utc' });
  return `${dt.toFormat("yyyyLLdd'T'HHmmss")}Z`;
}

function escapeText(input: string | undefined): string | undefined {
  if (!input) return input;
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line: string): string {
  if (line.length <= 73) return line; // 75 octets guideline; use conservative 73 chars
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    const end = Math.min(i + 73, line.length);
    const chunk = line.slice(i, end);
    chunks.push(i === 0 ? chunk : ` ${chunk}`);
    i = end;
  }
  return chunks.join('\r\n');
}

function build(lines: string[]): string {
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export const IcsFormat = {
  toIcsDateTimeLocal,
  toIcsDateTimeUtc,
  escapeText,
  foldLine,
  build,
};

export type { DateTime };
