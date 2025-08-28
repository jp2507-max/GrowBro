import crypto from 'crypto';

type AnyObject = { [k: string]: any };

function sha256Short(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
}

const EMAIL_RE = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PHONE_RE = /(?:\+?\d[\d ()-]{7,}\d)/g;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const MAC_RE = /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g;
const SERIAL_RE = /\b(?:serial|sn|serialnumber)[:= ]?\s*([A-Za-z0-9-]{4,})\b/gi;
const NAME_RE = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;

function sanitizeText(s: string) {
  if (!s) return s;

  // Replace emails
  s = s.replace(
    EMAIL_RE,
    (_, user, host) => `__PII_E_${sha256Short(user + '@' + host)}__`
  );
  // Replace IPs before phones so IPs aren't matched as phones
  s = s.replace(IP_RE, (m) => `__PII_IP_${sha256Short(m)}__`);
  // Replace MACs
  s = s.replace(MAC_RE, (m) => `__PII_M_${sha256Short(m)}__`);
  // Replace serial tokens
  s = s.replace(SERIAL_RE, (_m, value) => `__PII_S_${sha256Short(value)}__`);
  // Replace phone numbers (after IP)
  s = s.replace(PHONE_RE, (m) => `__PII_P_${sha256Short(m)}__`);
  // Replace simple full-name heuristics
  s = s.replace(NAME_RE, (_, a, b) => `__PII_N_${sha256Short(a + ' ' + b)}__`);

  return s;
}

function isPlainObject(v: any) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function stripPIIFromObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stripPIIFromObject);
  if (!isPlainObject(obj))
    return typeof obj === 'string' ? sanitizeText(obj) : obj;

  const out: AnyObject = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    // Remove known identifier keys anywhere in the tree
    if (
      ['userid', 'accountid', 'deviceid', 'sessionid', 'authtoken'].includes(lk)
    )
      continue;
    if (
      [
        'mac',
        'macaddress',
        'serial',
        'serialnumber',
        'imei',
        'imsi',
        'ip',
        'ipaddress',
      ].includes(lk)
    )
      continue;

    if (typeof v === 'string') {
      out[k] = sanitizeText(v);
      continue;
    }

    if (isPlainObject(v)) {
      // Drop EXIF-like blocks
      if (lk === 'exif' || lk === 'gps' || lk === 'exifdata') continue;
      out[k] = stripPIIFromObject(v);
      continue;
    }

    if (Array.isArray(v)) {
      out[k] = v.map((item) => stripPIIFromObject(item));
      continue;
    }

    out[k] = v;
  }
  return out;
}

export function stripPII(playbook: any) {
  // Deep clone
  const cloned = JSON.parse(JSON.stringify(playbook));

  // Remove top-level identifiers
  for (const idKey of [
    'userId',
    'accountId',
    'deviceId',
    'sessionId',
    'authToken',
  ]) {
    if (idKey in cloned) delete cloned[idKey];
  }

  // Normalize steps: only keep allowed fields
  if (Array.isArray(cloned.steps)) {
    cloned.steps = cloned.steps.map((step: any) => {
      const allowed: AnyObject = {};
      if ('id' in step) allowed.id = step.id;
      if ('title' in step)
        allowed.title =
          typeof step.title === 'string'
            ? sanitizeText(step.title)
            : step.title;
      if ('description' in step)
        allowed.description =
          typeof step.description === 'string'
            ? sanitizeText(step.description)
            : step.description;
      // Preserve recurrence information using model-aligned field `rrule`.
      // Prefer `step.rrule` when present, otherwise fall back to legacy `step.schedule`.
      if ('rrule' in step || 'schedule' in step) {
        allowed.rrule = stripPIIFromObject(step.rrule ?? step.schedule);
      }
      if (Array.isArray(step.attachments)) {
        allowed.attachments = step.attachments.map((att: any) => {
          const a: AnyObject = {};
          if ('filename' in att) a.filename = att.filename;
          if ('mimeType' in att) a.mimeType = att.mimeType;
          if ('width' in att) a.width = att.width;
          if ('height' in att) a.height = att.height;
          if ('hash' in att) a.hash = att.hash;
          // drop exif/metadata
          return a;
        });
      }
      if ('metadata' in step)
        allowed.metadata = stripPIIFromObject(step.metadata);
      return allowed;
    });
  }

  // Walk remaining tree to sanitize strings and remove known keys
  const final = stripPIIFromObject(cloned);

  return final;
}

export default stripPII;
