import { describe, expect, it } from 'vitest';

import {
  buildCompanyPatch,
  buildPersonPatch,
  checkCompanyDomain,
  isRecordComplete,
  parseRange,
  pickEmployeeBucket,
  PERSON_TARGET_FIELDS,
} from 'src/logic-functions/core/mapping';
import { COMPANY, LEAD, OUR_COMPANY_SCHEMA, OUR_PERSON_SCHEMA, STOCK_PERSON_SCHEMA } from './fixtures';

const EMPTY_PERSON = {
  id: 'p1',
  name: { firstName: '', lastName: '' },
  emails: { primaryEmail: '' },
  linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/someone/' },
  jobTitle: '',
  description: null,
  twitter: null,
  primaryLocation: { addressCity: '', addressState: '', addressCountry: '', addressStreet1: '', addressPostcode: '' },
};

describe('buildPersonPatch', () => {
  it('fills every empty mapped field', () => {
    const { patch, written, kept } = buildPersonPatch({ ...EMPTY_PERSON, linkedinLink: { primaryLinkUrl: '' } }, LEAD, OUR_PERSON_SCHEMA);
    expect(patch.name).toEqual({ firstName: 'Rafael', lastName: 'Testwell' });
    expect(patch.jobTitle).toBe('Account Executive');
    expect(patch.linkedinLink).toEqual({ primaryLinkUrl: 'https://www.linkedin.com/in/sandbox-rafael-testwell-asbjxx/' });
    expect(patch.description).toBe('Account Executive at Sandbox Robotics');
    expect(patch.primaryLocation).toEqual({ addressCity: 'Austin', addressState: 'Texas', addressCountry: 'United States' });
    expect(patch.generectHeadline).toBe('Account Executive at Sandbox Robotics');
    expect(patch.generectLocation).toBe('Austin, United States');
    expect(patch.generectCompanyName).toBe('Sandbox Robotics');
    expect(patch.generectIndustry).toBe('Industrial Machinery Manufacturing');
    expect(patch.generectLeadId).toBe('ACwAAARQPraiLtgLuy3rhj9heH52Z1XHmAsBJXX');
    expect(patch.generectRaw).toBe(LEAD);
    expect(written).toContain('jobTitle');
    expect(kept).toEqual([]);
  });

  it('never overwrites a filled field (names, job title, LinkedIn, location, app fields)', () => {
    const filled = {
      ...EMPTY_PERSON,
      name: { firstName: 'Raf', lastName: 'T.' },
      jobTitle: 'CEO',
      description: 'my own notes',
      primaryLocation: { addressCity: 'Kyiv', addressCountry: 'Ukraine' },
      generectHeadline: 'old headline',
    };
    const { patch, kept } = buildPersonPatch(filled, LEAD, OUR_PERSON_SCHEMA);
    expect(patch.name).toBeUndefined();
    expect(patch.jobTitle).toBeUndefined();
    expect(patch.linkedinLink).toBeUndefined();
    expect(patch.description).toBeUndefined();
    expect(patch.primaryLocation).toBeUndefined();
    expect(patch.generectHeadline).toBeUndefined();
    expect(kept).toEqual(expect.arrayContaining(['name', 'jobTitle', 'linkedinLink', 'description', 'primaryLocation', 'generectHeadline']));
    // the same profile written differently is not reported as "kept"
    const same = buildPersonPatch({ ...filled, linkedinLink: { primaryLinkUrl: 'https://linkedin.com/in/sandbox-rafael-testwell-asbjxx' } }, LEAD, OUR_PERSON_SCHEMA);
    expect(same.kept).not.toContain('linkedinLink');
  });

  it('fills only the empty half of a name', () => {
    const { patch } = buildPersonPatch({ ...EMPTY_PERSON, name: { firstName: 'Rafa', lastName: '' } }, LEAD, OUR_PERSON_SCHEMA);
    expect(patch.name).toEqual({ firstName: 'Rafa', lastName: 'Testwell' });
  });

  it('does not write a headline as job title when there is no current position', () => {
    const { patch } = buildPersonPatch(EMPTY_PERSON, { ...LEAD, has_current_position: false }, OUR_PERSON_SCHEMA);
    expect(patch.jobTitle).toBeUndefined();
  });

  it('skips fields the workspace does not have instead of failing', () => {
    const { patch, missing } = buildPersonPatch(EMPTY_PERSON, { ...LEAD, twitter_link: 'https://x.com/r' }, STOCK_PERSON_SCHEMA);
    expect(patch.description).toBeUndefined();
    expect(patch.primaryLocation).toBeUndefined();
    expect(patch.twitter).toBeUndefined();
    expect(missing).toEqual(expect.arrayContaining(['description', 'primaryLocation', 'twitter', 'city']));
    expect(patch.jobTitle).toBe('Account Executive');
  });

  it('skips a location without a country, or with only a country', () => {
    const a = buildPersonPatch(EMPTY_PERSON, { ...LEAD, location_country: null }, OUR_PERSON_SCHEMA);
    const b = buildPersonPatch(EMPTY_PERSON, { ...LEAD, location_city: null, location_state: null }, OUR_PERSON_SCHEMA);
    expect(a.patch.primaryLocation).toBeUndefined();
    expect(b.patch.primaryLocation).toBeUndefined();
  });

  it('never writes a non-profile URL into LinkedIn', () => {
    const { patch } = buildPersonPatch(
      { ...EMPTY_PERSON, linkedinLink: { primaryLinkUrl: '' } },
      { ...LEAD, linkedin_url: 'https://www.linkedin.com/company/acme' },
      OUR_PERSON_SCHEMA,
    );
    expect(patch.linkedinLink).toBeUndefined();
  });
});

describe('buildCompanyPatch', () => {
  const EMPTY_COMPANY = { id: 'c1', name: '', domainName: { primaryLinkUrl: '' }, linkedinLink: { primaryLinkUrl: '' }, address: {} };

  it('fills empty standard and app fields', () => {
    const { patch } = buildCompanyPatch(EMPTY_COMPANY, COMPANY, OUR_COMPANY_SCHEMA);
    expect(patch.name).toBe('Northwind Analytics');
    expect(patch.domainName).toEqual({ primaryLinkUrl: 'https://northwind-analytics.example.com' });
    expect(patch.linkedinLink).toEqual({ primaryLinkUrl: 'https://www.linkedin.com/company/northwind-analytics-test/' });
    expect(patch.address).toEqual({ addressCity: 'London', addressState: 'England', addressCountry: 'United Kingdom' });
    expect(patch.employeeRange).toBe('N_251_1K'); // exact 640 fits 251-1000
    expect(patch.industry).toBe('Data Infrastructure and Analytics');
    expect(patch.foundationDate).toBe('2011-01-01');
    expect(patch.generectHeadcount).toBe(640);
    expect(patch.generectFoundedYear).toBe(2011);
    expect(patch.generectDomain).toBe('northwind-analytics.example.com');
    expect(patch.logoUrl).toBeUndefined(); // null in payload
  });

  it('builds the LinkedIn page from linkedin_urn when the database path has no linkedin_link', () => {
    const { patch } = buildCompanyPatch(EMPTY_COMPANY, { ...COMPANY, linkedin_link: undefined, linkedin_urn: 'vercel' }, OUR_COMPANY_SCHEMA);
    expect(patch.linkedinLink).toEqual({ primaryLinkUrl: 'https://www.linkedin.com/company/vercel/' });
  });

  it('keeps the existing name, domain and description', () => {
    const { patch, kept } = buildCompanyPatch(
      { ...EMPTY_COMPANY, name: 'Northwind', domainName: { primaryLinkUrl: 'https://northwind.io' }, description: 'ours' },
      COMPANY,
      OUR_COMPANY_SCHEMA,
    );
    expect(patch.name).toBeUndefined();
    expect(patch.domainName).toBeUndefined();
    expect(patch.description).toBeUndefined();
    expect(kept).toEqual(expect.arrayContaining(['name', 'domainName', 'description']));
  });
});

describe('employee buckets', () => {
  const buckets = OUR_COMPANY_SCHEMA.enums.CompanyEmployeeRangeEnum;
  it('parses ranges', () => {
    expect(parseRange('51-200')).toEqual([51, 200]);
    expect(parseRange('10001+')).toEqual([10001, Infinity]);
    expect(parseRange('N_251_1K')).toEqual([251, 1000]);
    expect(parseRange('N_100K')).toEqual([100000, Infinity]);
  });
  it('picks a bucket only when the range fits entirely', () => {
    expect(pickEmployeeBucket('51-200', null, buckets)).toBe('N_51_250');
    expect(pickEmployeeBucket('201-500', null, buckets)).toBeNull(); // straddles 51-250 / 251-1K
    expect(pickEmployeeBucket('10001+', null, buckets)).toBeNull(); // ambiguous
    expect(pickEmployeeBucket('201-500', 300, buckets)).toBe('N_251_1K'); // exact wins
  });
});

describe('checkCompanyDomain', () => {
  it('lookup by domain: Generect domain must equal the record domain', () => {
    expect(checkCompanyDomain('domain', 'stripe.com', { domain: 'stripe.com' }).ok).toBe(true);
    expect(checkCompanyDomain('domain', 'stripe.com', { website: 'https://www.stripe.com/' }).ok).toBe(true);
    expect(checkCompanyDomain('domain', 'stripe.com', { domain: 'northwind-analytics.example.com' }).ok).toBe(false);
    expect(checkCompanyDomain('domain', 'stripe.com', {}).ok).toBe(false);
  });
  it('lookup by own LinkedIn page: block only when both domains are known and differ', () => {
    expect(checkCompanyDomain('linkedin_url', null, { domain: 'x.com' }).ok).toBe(true);
    expect(checkCompanyDomain('linkedin_url', 'y.com', {}).ok).toBe(true);
    expect(checkCompanyDomain('linkedin_url', 'y.com', { domain: 'x.com' }).ok).toBe(false);
  });
});

describe('isRecordComplete', () => {
  it('is complete only when every existing target field has a value', () => {
    const full = {
      id: 'p',
      name: { firstName: 'A', lastName: 'B' },
      jobTitle: 'CEO',
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/a/' },
      generectHeadline: 'h',
      generectLocation: 'l',
      generectCompanyName: 'c',
      generectIndustry: 'i',
      generectLeadId: '1',
    };
    expect(isRecordComplete(full, OUR_PERSON_SCHEMA, PERSON_TARGET_FIELDS)).toBe(true);
    expect(isRecordComplete({ ...full, jobTitle: '' }, OUR_PERSON_SCHEMA, PERSON_TARGET_FIELDS)).toBe(false);
    expect(isRecordComplete({ ...full, name: { firstName: 'A', lastName: '' } }, OUR_PERSON_SCHEMA, PERSON_TARGET_FIELDS)).toBe(false);
  });
});
