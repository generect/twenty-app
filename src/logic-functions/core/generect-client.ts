// Generect API client. Server-side only (logic functions); the key never reaches the browser.
//
// Cost rules baked in here:
//  - /database/ endpoints by default ($0.02 per hit, $0 per miss); realtime only for a LinkedIn
//    lookup and only when the workspace opted in. Never realtime by email (same work, double price).
//  - 402 / "Insufficient funds" -> stop the whole run.
//  - 429 and 5xx -> retry after 1 s then 3 s, honouring Retry-After (capped).
//  - Anything that may already have been charged (a 200, a timeout mid-request) is never retried.

export const GENERECT_API_BASE = 'https://api.generect.com/api/v1';

export type LookupKind = 'lead' | 'company';
export type LeadIdentifier = { linkedin_url: string } | { email: string };
export type CompanyIdentifier = { linkedin_url: string } | { domain: string };

export type GenerectOutcome<T> =
  | { kind: 'match'; data: T; amountCharged: number; endpoint: string; attempts: number }
  | { kind: 'no_match'; amountCharged: number; endpoint: string; detail: string; attempts: number }
  | { kind: 'insufficient_credits'; endpoint: string; detail: string; attempts: number }
  | { kind: 'auth_error'; endpoint: string; detail: string; attempts: number }
  | { kind: 'error'; endpoint: string; detail: string; status: number | null; attempts: number };

export type GenerectClientOptions = {
  apiKey: string;
  realtimeLinkedin?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: number[];
  maxRetryAfterMs?: number;
  timeoutMs?: number;
  userAgent?: string;
};

const NO_MATCH_DETAILS = [/does not exist/i, /not found/i];
const RETRY_NETWORK_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const endpointFor = (kind: LookupKind, identifier: Record<string, string>, realtimeLinkedin: boolean): string => {
  const realtime = realtimeLinkedin && 'linkedin_url' in identifier;
  return `/enrich/${realtime ? 'realtime' : 'database'}/${kind}/`;
};

const parseRetryAfter = (header: string | null, fallbackMs: number, capMs: number): number => {
  if (!header) return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, capMs);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), capMs);
  return fallbackMs;
};

const detailOf = (body: unknown, text: string): string => {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const d = b.detail ?? b.message ?? b.error ?? b.reason;
    if (typeof d === 'string') return d;
    if (d) return JSON.stringify(d).slice(0, 300);
  }
  return text.slice(0, 300);
};

export const createGenerectClient = (options: GenerectClientOptions) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retryDelays = options.retryDelaysMs ?? [1000, 3000];
  const maxRetryAfter = options.maxRetryAfterMs ?? 10_000;
  const timeoutMs = options.timeoutMs ?? 90_000;
  const testKey = options.apiKey.startsWith('test_');

  const call = async <T>(kind: LookupKind, identifier: Record<string, string>): Promise<GenerectOutcome<T>> => {
    const endpoint = endpointFor(kind, identifier, options.realtimeLinkedin ?? false);
    let attempts = 0;
    for (;;) {
      attempts += 1;
      let response: Response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetchImpl(`${GENERECT_API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${options.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': options.userAgent ?? 'twenty-app-generect',
          },
          body: JSON.stringify(identifier),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timer);
        const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
        // Only retry failures that certainly happened before the request reached Generect.
        if (code && RETRY_NETWORK_CODES.has(code) && attempts <= retryDelays.length) {
          await sleep(retryDelays[attempts - 1]);
          continue;
        }
        return { kind: 'error', endpoint, status: null, attempts, detail: `network: ${String((error as Error)?.message ?? error)}` };
      }
      clearTimeout(timer);

      const text = await response.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      const detail = detailOf(body, text);

      if (response.ok) {
        const data = (body as { data?: T } | null)?.data;
        // A test_ key returns sample data with the live price in meta.amount_charged but is never charged.
        const amount = testKey ? 0 : Number((body as { meta?: { amount_charged?: unknown } } | null)?.meta?.amount_charged ?? 0) || 0;
        if (data && typeof data === 'object') return { kind: 'match', data, amountCharged: amount, endpoint, attempts };
        return { kind: 'no_match', amountCharged: amount, endpoint, attempts, detail: 'empty data' };
      }
      if (response.status === 402 || /insufficient funds/i.test(detail)) {
        return { kind: 'insufficient_credits', endpoint, attempts, detail };
      }
      if (response.status === 401 || response.status === 403) {
        return { kind: 'auth_error', endpoint, attempts, detail };
      }
      if ((response.status === 400 || response.status === 404) && NO_MATCH_DETAILS.some((r) => r.test(detail))) {
        return { kind: 'no_match', amountCharged: 0, endpoint, attempts, detail };
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempts <= retryDelays.length) {
        await sleep(parseRetryAfter(response.headers.get('retry-after'), retryDelays[attempts - 1], maxRetryAfter));
        continue;
      }
      return { kind: 'error', endpoint, status: response.status, attempts, detail };
    }
  };

  return {
    enrichLead: (identifier: LeadIdentifier) => call<Record<string, unknown>>('lead', identifier as Record<string, string>),
    enrichCompany: (identifier: CompanyIdentifier) =>
      call<Record<string, unknown>>('company', identifier as Record<string, string>),
  };
};

export type GenerectClient = ReturnType<typeof createGenerectClient>;
