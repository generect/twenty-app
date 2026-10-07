import { describe, expect, it } from 'vitest';

import { healthCheck } from 'src/logic-functions/health-check';
import { extractRecordIds, isWorkflowRun } from 'src/logic-functions/core/triggers';
import { normalizeDomain, normalizeLinkedinPersonUrl } from 'src/logic-functions/core/util';

describe('route input', () => {
  it('accepts the button body and workflow record objects', () => {
    expect(extractRecordIds({ body: { recordIds: ['a', 'b'] } })).toEqual(['a', 'b']);
    expect(extractRecordIds({ recordIds: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
    expect(extractRecordIds({ records: { id: 'z' } })).toEqual(['z']);
    expect(extractRecordIds({ body: null })).toEqual([]);
  });
  it('tells an unattended workflow run from a click', () => {
    expect(isWorkflowRun({ body: { recordIds: ['a'] }, headers: {} })).toBe(false);
    expect(isWorkflowRun({ recordIds: ['a'] })).toBe(true);
  });
});

describe('health check', () => {
  it('asks for a key when there is none', () => {
    expect(healthCheck({})).toMatchObject({ status: 'WARNING', title: 'Add your Generect API key' });
    expect(healthCheck({ GENERECT_API_KEY: '  ' })).toMatchObject({ status: 'WARNING' });
  });
  it('says test mode for a test_ key, OK for a live one', () => {
    expect(healthCheck({ GENERECT_API_KEY: 'test_0123' })).toMatchObject({ status: 'INFO', title: 'Test mode' });
    expect(healthCheck({ GENERECT_API_KEY: '"live-key"' })).toEqual({ status: 'OK' });
  });
});

describe('normalisers', () => {
  it('normalises domains and LinkedIn URLs', () => {
    expect(normalizeDomain('https://www.Stripe.com/about?x=1')).toBe('stripe.com');
    expect(normalizeDomain('not a domain')).toBeNull();
    expect(normalizeLinkedinPersonUrl('linkedin.com/in/Satya-Nadella?trk=x')).toBe('https://www.linkedin.com/in/satya-nadella/');
    expect(normalizeLinkedinPersonUrl('https://www.linkedin.com/company/microsoft')).toBeNull();
  });
});
