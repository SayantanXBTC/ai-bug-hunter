// Client-side hard filter to guarantee sensitive form/element data never renders.
// The backend discovery model may include fields that we must NEVER show:
//   value, defaultValue, currentValue, password, secret
// Anything password-typed also has its label/name preserved but no value.
// We also refuse to render if the key itself contains "password" or "secret".

const FORBIDDEN_KEYS = new Set([
  'value',
  'defaultValue',
  'defaultvalue',
  'currentValue',
  'currentvalue',
  'password',
  'secret',
]);

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN_KEYS.has(lower)) return true;
  if (lower.includes('password')) return true;
  if (lower.includes('secret')) return true;
  return false;
}

export function sanitizeField<T>(field: T): T {
  if (field === null || typeof field !== 'object') return field;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(field as Record<string, unknown>)) {
    if (isForbiddenKey(k)) continue;
    out[k] = v;
  }
  return out as T;
}

export function filterFormFields<T>(fields: T[] | undefined | null): T[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => sanitizeField(f));
}

// Redact a display string that might contain sensitive substrings. Used only defensively.
export function maskSensitive(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/(password|secret)[^\s,;]*/gi, '[redacted]');
}

// If a field name (label, selector, form field name) suggests it holds a
// credential, mask the value. Otherwise return it unchanged.
const SENSITIVE_FIELD_RE = /pass(word)?|secret|token|api[_-]?key|auth/i;

export function maskFieldValue(fieldName: string | undefined | null, value: string): string {
  if (fieldName && SENSITIVE_FIELD_RE.test(fieldName)) return '••••••••';
  return value;
}
