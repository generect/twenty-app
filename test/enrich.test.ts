import { describe, expect, it, vi } from 'vitest';

import { enrichRecords, identifierHash, pickPersonIdentifier, readConfig } from 'src/logic-functions/core/enrich';
import { type GenerectClient, type GenerectOutcome } from 'src/logic-functions/core/generect-client';
import { type TwentyRecord } from 'src/logic-functions/core/mapping';
import { type TwentyApi } from 'src/logic-functions/core/twenty-api';
import { COMPANY, LEAD, OUR_COMPANY_SCHEMA, OUR_PERSON_SCHEMA } from './fixtures';

const NOW = Date.parse('2026-09-27T12:00:00Z');

const fakeApi = (records: TwentyRecord[], opts?: { failUpdateFor?: string[] }) => {
  const store = new Map(records.map((r) => [r.id, structuredClone(r)]));
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  const api: TwentyApi = {
    getSchema: async (kind) => (kind === 'person' ? OUR_PERSON_SCHEMA : OUR_COMPANY_SCHEMA),
    readRecords: async (_kind, ids) => ids.map((id) => store.get(id)).filter((r): r is TwentyRecord => !!r),
    updateRecord: async (_kind, id, data) => {
      if (opts?.failUpdateFor?.includes(id) && 'generectRaw' in data) throw new Error('field validation failed');
      updates.push({ id, data });
      store.set(id, { ...(store.get(id) as TwentyRecord), ...data });
    },
  };
  return { api, updates, store };
};

const fakeGenerect = (outcomes: GenerectOutcome<Record<string, unknown>>[]) => {
  const enrichLead = vi.fn(async () => outcomes.shift() as GenerectOutcome<Record<string, unknown>>);
  const enrichCompany = vi.fn(async () => outcomes.shift() as GenerectOutcome<Record<string, unknown>>);
  return { client: { enrichLead, enrichCompany } as unknown as GenerectClient, enrichLead, enrichCompany };
};

const match = (data: Record<string, unknown>, amount = 0.02): GenerectOutcome<Record<string, unknown>> => ({
  kind: 'match',
  data,
  amountCharged: amount,
  endpoint: '/enrich/database/lead/',
  attempts: 1,
});

const person = (id: string, extra: Record<string, unknown> = {}): TwentyRecord => ({
  id,
  name: { firstName: 'Satya', lastName: '' },
  emails: { primaryEmail: '' },
  linkedinLink: { primaryLinkUrl: `https://linkedin.com/in/${id}` },
  jobTitle: 'Chairman and CEO',
  ...extra,
});

const deps = (api: TwentyApi, generect: GenerectClient, extra: Record<string, unknown> = {}) => ({
  api,
  generect,
  now: () => NOW,
  maxSpendUsd: 5,
  maxRecords: 50,
  mode: 'manual' as const,
  ...extra,
});

describe('enrichRecords', () => {
  it('writes empty fields + MATCHED status, leaves pre-filled fields untouched', async () => {
    const { api, updates } = fakeApi([person('p1')]);
    const g = fakeGenerect([match(LEAD)]);
    const run = await enrichRecords('person', ['p1'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('MATCHED');
    expect(run.spentUsd).toBe(0.02);
    const data = updates[0].data;
    expect(data.jobTitle).toBeUndefined(); // pre-filled "Chairman and CEO" kept
    expect(data.name).toEqual({ firstName: 'Satya', lastName: 'Testwell' }); // only the empty half
    expect(data.linkedinLink).toBeUndefined();
    expect(data.generectStatus).toBe('MATCHED');
    expect(data.generectEnrichedAt).toBe('2026-09-27T12:00:00.000Z');
    expect(data.generectInputHash).toBe(identifierHash('person', pickPersonIdentifier(person('p1'))));
    expect(String(data.generectMessage)).toContain('kept existing');
    expect(g.enrichLead).toHaveBeenCalledWith({ linkedin_url: 'https://www.linkedin.com/in/p1/' });
  });

  it('looks up by email when there is no LinkedIn URL; stores the post-write hash (loop protection)', async () => {
    const rec = person('p2', { linkedinLink: { primaryLinkUrl: '' }, emails: { primaryEmail: 'Satya@Microsoft.com' } });
    const { api, updates } = fakeApi([rec]);
    const g = fakeGenerect([match(LEAD)]);
    await enrichRecords('person', ['p2'], deps(api, g.client));
    expect(g.enrichLead).toHaveBeenCalledWith({ email: 'satya@microsoft.com' });
    const data = updates[0].data;
    expect(data.linkedinLink).toEqual({ primaryLinkUrl: 'https://www.linkedin.com/in/sandbox-rafael-testwell-asbjxx/' });
    // the hash matches the identifier the record has AFTER our write, so our own update event is a no-op
    expect(data.generectInputHash).toBe(
      identifierHash('person', { kind: 'linkedin_url', value: 'https://www.linkedin.com/in/sandbox-rafael-testwell-asbjxx/' }),
    );
  });

  it('stops the whole run on 402 and never calls Generect again', async () => {
    const { api, updates } = fakeApi([person('a'), person('b'), person('c')]);
    const g = fakeGenerect([
      match(LEAD),
      { kind: 'insufficient_credits', endpoint: '/enrich/database/lead/', detail: 'Insufficient funds in the account.', attempts: 1 },
      match(LEAD),
    ]);
    const run = await enrichRecords('person', ['a', 'b', 'c'], deps(api, g.client));
    expect(run.results.map((r) => r.outcome)).toEqual(['MATCHED', 'INSUFFICIENT_CREDITS', 'SKIPPED_RUN_STOPPED']);
    expect(g.enrichLead).toHaveBeenCalledTimes(2);
    expect(updates.find((u) => u.id === 'b')?.data.generectStatus).toBe('INSUFFICIENT_CREDITS');
    expect(run.stoppedReason).toContain('402');
  });

  it('paid 200 + failed CRM write -> WRITE_FAILED, lookup not repeated', async () => {
    const { api, updates } = fakeApi([person('w')], { failUpdateFor: ['w'] });
    const g = fakeGenerect([match(LEAD)]);
    const run = await enrichRecords('person', ['w'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('WRITE_FAILED');
    expect(run.spentUsd).toBe(0.02);
    expect(g.enrichLead).toHaveBeenCalledTimes(1);
    expect(updates[0].data.generectStatus).toBe('WRITE_FAILED');
  });

  it('a LinkedIn URL with a stray % does not abort the run for the other records (pre-PR review, 07.10)', async () => {
    const { api } = fakeApi([person('odd', { linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/50%off' } }), person('ok')]);
    const noMatch: GenerectOutcome<Record<string, unknown>> = { kind: 'no_match', amountCharged: 0, endpoint: '/enrich/database/lead/', detail: 'not found', attempts: 1 };
    const g = fakeGenerect([noMatch, match(LEAD)]);
    const run = await enrichRecords('person', ['odd', 'ok'], deps(api, g.client));
    expect(run.results.map((r) => r.outcome)).toEqual(['NO_MATCH', 'MATCHED']);
    expect(g.enrichLead.mock.calls[0]).toEqual([{ linkedin_url: 'https://www.linkedin.com/in/50%off/' }]);
  });

  it('anything failing after a paid match records WRITE_FAILED with the input hash (no second payment)', async () => {
    const { api, updates } = fakeApi([person('p')]);
    const exploding = new Proxy({}, { get: () => { throw new Error('unexpected payload'); } }) as Record<string, unknown>;
    const g = fakeGenerect([match(exploding)]);
    const run = await enrichRecords('person', ['p'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('WRITE_FAILED');
    expect(run.results[0].message).toContain('unexpected payload');
    const status = updates.find((u) => u.id === 'p')?.data;
    expect(status?.generectStatus).toBe('WRITE_FAILED');
    expect(status?.generectInputHash).toBeTruthy();
  });

  it('automatic mode never retries a WRITE_FAILED record with the same input', async () => {
    const rec = person('w');
    const hash = identifierHash('person', pickPersonIdentifier(rec));
    const { api } = fakeApi([
      { ...rec, generectStatus: 'WRITE_FAILED', generectInputHash: hash, generectLastAttemptAt: '2026-01-01T00:00:00Z' },
    ]);
    const g = fakeGenerect([match(LEAD)]);
    const run = await enrichRecords('person', ['w'], deps(api, g.client, { mode: 'auto' }));
    expect(run.results[0].outcome).toBe('SKIPPED_UNCHANGED');
    expect(g.enrichLead).not.toHaveBeenCalled();
  });

  it('skips an unchanged, recently matched record without calling Generect', async () => {
    const rec = person('u');
    const hash = identifierHash('person', pickPersonIdentifier(rec));
    const { api, updates } = fakeApi([
      { ...rec, generectStatus: 'MATCHED', generectInputHash: hash, generectLastAttemptAt: '2026-09-20T00:00:00Z' },
    ]);
    const g = fakeGenerect([]);
    const run = await enrichRecords('person', ['u'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('SKIPPED_UNCHANGED');
    expect(updates).toHaveLength(0);
  });

  it('re-looks-up a NO_MATCH after 30 days', async () => {
    const rec = person('n');
    const hash = identifierHash('person', pickPersonIdentifier(rec));
    const { api } = fakeApi([{ ...rec, generectStatus: 'NO_MATCH', generectInputHash: hash, generectLastAttemptAt: '2026-08-01T00:00:00Z' }]);
    const g = fakeGenerect([{ kind: 'no_match', amountCharged: 0, endpoint: 'x', detail: 'Person does not exist', attempts: 1 }]);
    const run = await enrichRecords('person', ['n'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('NO_MATCH');
    expect(g.enrichLead).toHaveBeenCalledTimes(1);
  });

  it('NO_IDENTIFIER and COMPLETE cost nothing', async () => {
    const full = person('f', {
      name: { firstName: 'A', lastName: 'B' },
      generectHeadline: 'h',
      generectLocation: 'l',
      generectCompanyName: 'c',
      generectIndustry: 'i',
      generectLeadId: '1',
    });
    const none = person('x', { linkedinLink: { primaryLinkUrl: 'https://example.com/me' }, emails: { primaryEmail: '' } });
    const { api } = fakeApi([full, none]);
    const g = fakeGenerect([]);
    const run = await enrichRecords('person', ['f', 'x'], deps(api, g.client));
    expect(run.results.map((r) => r.outcome)).toEqual(['COMPLETE', 'NO_IDENTIFIER']);
    expect(g.enrichLead).not.toHaveBeenCalled();
  });

  it('enforces the per-run spend cap', async () => {
    const { api } = fakeApi([person('a'), person('b'), person('c')]);
    const g = fakeGenerect([match(LEAD), match(LEAD), match(LEAD)]);
    const run = await enrichRecords('person', ['a', 'b', 'c'], deps(api, g.client, { maxSpendUsd: 0.05 }));
    expect(run.results.map((r) => r.outcome)).toEqual(['MATCHED', 'SKIPPED_RUN_STOPPED', 'SKIPPED_RUN_STOPPED']);
    expect(g.enrichLead).toHaveBeenCalledTimes(1);
  });

  it('a cap of 0 makes no paid lookup at all', async () => {
    const { api } = fakeApi([person('a'), person('b')]);
    const g = fakeGenerect([match(LEAD), match(LEAD)]);
    const run = await enrichRecords('person', ['a', 'b'], deps(api, g.client, { maxSpendUsd: 0 }));
    expect(run.results.map((r) => r.outcome)).toEqual(['SKIPPED_RUN_STOPPED', 'SKIPPED_RUN_STOPPED']);
    expect(g.enrichLead).not.toHaveBeenCalled();
    expect(run.spentUsd).toBe(0);
  });

  it('automatic mode skips Attio-mirrored records', async () => {
    const { api } = fakeApi([person('m', { attioRecordId: 'rec_123' })]);
    const g = fakeGenerect([match(LEAD)]);
    const run = await enrichRecords('person', ['m'], deps(api, g.client, { mode: 'auto' }));
    expect(run.results[0].outcome).toBe('SKIPPED_MIRRORED');
    expect(g.enrichLead).not.toHaveBeenCalled();
  });

  it('company domain mismatch writes status only, no data', async () => {
    const { api, updates } = fakeApi([{ id: 'c', name: 'Stripe', domainName: { primaryLinkUrl: 'https://stripe.com' }, linkedinLink: { primaryLinkUrl: '' } }]);
    const g = fakeGenerect([match(COMPANY)]);
    const run = await enrichRecords('company', ['c'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('MISMATCH');
    expect(g.enrichCompany).toHaveBeenCalledWith({ domain: 'stripe.com' });
    expect(Object.keys(updates[0].data).sort()).toEqual(['generectInputHash', 'generectLastAttemptAt', 'generectMessage', 'generectStatus']);
    expect(run.spentUsd).toBe(0.02); // a mismatch is still charged
  });

  it('company matched by domain fills empty fields and keeps the name', async () => {
    const { api, updates } = fakeApi([
      { id: 'c', name: 'Northwind', domainName: { primaryLinkUrl: 'northwind-analytics.example.com' }, linkedinLink: { primaryLinkUrl: '' }, address: {} },
    ]);
    const g = fakeGenerect([match(COMPANY)]);
    const run = await enrichRecords('company', ['c'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('MATCHED');
    const data = updates[0].data;
    expect(data.name).toBeUndefined();
    expect(data.employeeRange).toBe('N_251_1K');
    expect(data.linkedinLink).toEqual({ primaryLinkUrl: 'https://www.linkedin.com/company/northwind-analytics-test/' });
  });

  it('never looks up a freemail domain as a company', async () => {
    const { api } = fakeApi([{ id: 'g', name: 'x', domainName: { primaryLinkUrl: 'https://gmail.com' }, linkedinLink: { primaryLinkUrl: '' } }]);
    const g = fakeGenerect([]);
    const run = await enrichRecords('company', ['g'], deps(api, g.client));
    expect(run.results[0].outcome).toBe('NO_IDENTIFIER');
  });
});

describe('readConfig', () => {
  it('defaults: no key, database endpoints, $5 cap', () => {
    expect(readConfig({})).toEqual({ apiKey: null, realtimeLinkedin: false, maxSpendUsd: 5 });
  });
  it('tolerates JSON-encoded variable values', () => {
    const c = readConfig({ GENERECT_API_KEY: ' k ', REALTIME_LINKEDIN_LOOKUPS: '"true"', MAX_SPEND_PER_RUN_USD: '1.5' });
    expect(c).toEqual({ apiKey: 'k', realtimeLinkedin: true, maxSpendUsd: 1.5 });
  });
  it('a spend cap of 0 means no paid lookups, not the $5 default (pre-PR review, 07.10)', () => {
    expect(readConfig({ MAX_SPEND_PER_RUN_USD: '0' }).maxSpendUsd).toBe(0);
    expect(readConfig({ MAX_SPEND_PER_RUN_USD: '-3' }).maxSpendUsd).toBe(0);
    expect(readConfig({ MAX_SPEND_PER_RUN_USD: '' }).maxSpendUsd).toBe(5);
    expect(readConfig({ MAX_SPEND_PER_RUN_USD: 'abc' }).maxSpendUsd).toBe(5);
  });
  it('ignores the retired automatic-mode variables of 0.1.x', () => {
    expect(readConfig({ GENERECT_API_KEY: 'k', AUTO_ENRICH_MODE: 'CREATED' })).toEqual({ apiKey: 'k', realtimeLinkedin: false, maxSpendUsd: 5 });
  });
});
