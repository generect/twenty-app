import { describe, expect, it, vi } from 'vitest';

import { createGenerectClient } from 'src/logic-functions/core/generect-client';

type Reply = { status: number; body: unknown; headers?: Record<string, string> };

const fakeFetch = (replies: Reply[]) => {
  const calls: { url: string; body: unknown; auth: string | null }[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') });
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected extra call');
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: reply.headers });
  });
  return { impl: impl as unknown as typeof fetch, calls };
};

const client = (replies: Reply[], extra?: { realtimeLinkedin?: boolean }) => {
  const f = fakeFetch(replies);
  const sleeps: number[] = [];
  const c = createGenerectClient({
    apiKey: 'live_abc',
    fetchImpl: f.impl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...extra,
  });
  return { c, calls: f.calls, sleeps };
};

describe('generect client', () => {
  it('uses the /database/ endpoint and Token auth; reports amount_charged', async () => {
    const { c, calls } = client([{ status: 200, body: { data: { full_name: 'X' }, meta: { amount_charged: 0.02 } } }]);
    const out = await c.enrichLead({ linkedin_url: 'https://www.linkedin.com/in/x/' });
    expect(out).toMatchObject({ kind: 'match', amountCharged: 0.02, endpoint: '/enrich/database/lead/' });
    expect(calls[0].url).toBe('https://api.generect.com/api/v1/enrich/database/lead/');
    expect(calls[0].auth).toBe('Token live_abc');
    expect(calls[0].body).toEqual({ linkedin_url: 'https://www.linkedin.com/in/x/' });
  });

  it('realtime only for LinkedIn lookups when enabled, never by email', async () => {
    const ok = { status: 200, body: { data: { a: 1 }, meta: { amount_charged: 0.04 } } };
    const { c, calls } = client([ok, ok], { realtimeLinkedin: true });
    await c.enrichLead({ linkedin_url: 'https://www.linkedin.com/in/x/' });
    await c.enrichLead({ email: 'a@b.com' });
    expect(calls[0].url).toContain('/enrich/realtime/lead/');
    expect(calls[1].url).toContain('/enrich/database/lead/');
  });

  it('400 "does not exist" is a free no-match, not an error', async () => {
    const { c } = client([{ status: 400, body: { status: 'error', status_code: 400, detail: 'Person does not exist' } }]);
    expect(await c.enrichLead({ email: 'x@y.com' })).toMatchObject({ kind: 'no_match', amountCharged: 0 });
  });

  it('402 stops with insufficient_credits and is not retried', async () => {
    const { c, calls } = client([{ status: 402, body: { detail: 'Insufficient funds in the account.' } }]);
    expect((await c.enrichLead({ email: 'x@y.com' })).kind).toBe('insufficient_credits');
    expect(calls).toHaveLength(1);
  });

  it('"Insufficient funds" with a 400 status is still treated as out of credits', async () => {
    const { c } = client([{ status: 400, body: { detail: 'Insufficient funds in the account.' } }]);
    expect((await c.enrichCompany({ domain: 'a.com' })).kind).toBe('insufficient_credits');
  });

  it('retries 429 honouring Retry-After, then succeeds', async () => {
    const { c, calls, sleeps } = client([
      { status: 429, body: { detail: 'Too Many Requests' }, headers: { 'Retry-After': '2' } },
      { status: 200, body: { data: { a: 1 }, meta: { amount_charged: 0.02 } } },
    ]);
    expect((await c.enrichCompany({ domain: 'a.com' })).kind).toBe('match');
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it('retries 5xx at 1 s then 3 s, then gives up with an error', async () => {
    const e = { status: 502, body: { detail: 'Upstream data source is temporarily unavailable. Please retry.' } };
    const { c, calls, sleeps } = client([e, e, e]);
    const out = await c.enrichLead({ email: 'x@y.com' });
    expect(out).toMatchObject({ kind: 'error', status: 502, attempts: 3 });
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 3000]);
  });

  it('caps a huge Retry-After', async () => {
    const { c, sleeps } = client([
      { status: 429, body: {}, headers: { 'Retry-After': '3600' } },
      { status: 200, body: { data: { a: 1 }, meta: { amount_charged: 0.02 } } },
    ]);
    await c.enrichLead({ email: 'x@y.com' });
    expect(sleeps[0]).toBe(10_000);
  });

  it('401 is an auth error, not retried', async () => {
    const { c, calls } = client([{ status: 401, body: { detail: 'Authentication credentials were not provided.' } }]);
    expect((await c.enrichLead({ email: 'x@y.com' })).kind).toBe('auth_error');
    expect(calls).toHaveLength(1);
  });

  it('a timeout (request may have reached Generect) is never retried', async () => {
    const impl = vi.fn(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    const c = createGenerectClient({ apiKey: 'k', fetchImpl: impl as unknown as typeof fetch, sleep: async () => {} });
    expect((await c.enrichLead({ email: 'x@y.com' })).kind).toBe('error');
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('reports $0 for a test_ key, which is never charged (meta still carries the live price)', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ data: { full_name: 'X' }, meta: { amount_charged: 0.02 } }), { status: 200 })) as typeof fetch;
    const c = createGenerectClient({ apiKey: 'test_abc', fetchImpl, sleep: async () => {} });
    expect(await c.enrichLead({ linkedin_url: 'https://www.linkedin.com/in/x/' })).toMatchObject({ kind: 'match', amountCharged: 0 });
  });
});
