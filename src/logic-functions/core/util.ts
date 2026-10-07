// Small pure helpers shared by the mapping, the client and the triggers.

export const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

export const nonEmptyString = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

// FNV-1a, 2 x 32 bit. Not a security hash: it only answers "did the lookup input change".
export const inputHash = (value: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `v1:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
};

export const FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'web.de',
  'mail.ru',
  'yandex.ru',
  'ukr.net',
]);

// "https://www.Stripe.com/about" -> "stripe.com". Returns null for anything that is not a hostname.
export const normalizeDomain = (value: unknown): string | null => {
  const raw = nonEmptyString(value);
  if (!raw) return null;
  let host = raw.toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/)[0] ?? '';
  host = host.replace(/^[^@]*@/, '');
  host = host.replace(/:\d+$/, '');
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  return host;
};

const LINKEDIN_PERSON = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#]+)/i;
const LINKEDIN_COMPANY = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/company\/([^/?#]+)/i;

// Canonical https://www.linkedin.com/in/<slug>/ or null when it is not a profile URL.
export const normalizeLinkedinPersonUrl = (value: unknown): string | null => {
  const raw = nonEmptyString(value);
  const match = raw ? LINKEDIN_PERSON.exec(raw) : null;
  return match ? `https://www.linkedin.com/in/${decodeURIComponent(match[1]).toLowerCase()}/` : null;
};

export const normalizeLinkedinCompanyUrl = (value: unknown): string | null => {
  const raw = nonEmptyString(value);
  const match = raw ? LINKEDIN_COMPANY.exec(raw) : null;
  return match ? `https://www.linkedin.com/company/${decodeURIComponent(match[1]).toLowerCase()}/` : null;
};

export const normalizeEmail = (value: unknown): string | null => {
  const raw = nonEmptyString(value)?.toLowerCase() ?? null;
  return raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
};

// Application variables reach logic functions as strings; tolerate JSON-encoded values.
export const readVariable = (value: string | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return String(JSON.parse(trimmed));
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

export const readBooleanVariable = (value: string | undefined, fallback: boolean): boolean => {
  const v = readVariable(value)?.toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return fallback;
};

export const readNumberVariable = (value: string | undefined, fallback: number): number => {
  const v = Number(readVariable(value));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

// The spend cap: unset or unreadable = the default, 0 (or less) = no paid lookups at all. Only an empty value
// falls back: a workspace that types 0 to stop spending must not get the $5 default.
export const readSpendCap = (value: string | undefined, fallback: number): number => {
  const raw = readVariable(value);
  if (raw === null) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(v, 0);
};
