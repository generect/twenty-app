// Pure mapping from Generect payloads to Twenty record patches.
// Rules:
//  - fill only empty fields, never overwrite a value a human or another sync put there;
//  - write only into fields that exist and are writable in THIS workspace (schema read at runtime);
//  - names are never overwritten, job title only when the person has a current position;
//  - locations only with a country plus a city or state;
//  - the raw payload, status and timestamps are the only fields the app always rewrites.

import { hasField, type ObjectSchema } from 'src/logic-functions/core/schema';
import {
  isEmpty,
  nonEmptyString,
  normalizeDomain,
  normalizeLinkedinCompanyUrl,
  normalizeLinkedinPersonUrl,
  truncate,
} from 'src/logic-functions/core/util';

export type GenerectLead = Record<string, unknown> & {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  headline?: string | null;
  job_title?: string | null;
  has_current_position?: boolean | null;
  is_current?: boolean | null;
  company_still_working?: boolean | null;
  linkedin_url?: string | null;
  twitter_link?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  location_name?: string | null;
  company_name?: string | null;
  industry?: string | null;
  company_industry?: string | null;
  id?: string | number | null;
  sales_id?: string | number | null;
  linkedin_id?: string | null;
};

export type GenerectCompany = Record<string, unknown> & {
  name?: string | null;
  domain?: string | null;
  website?: string | null;
  linkedin_link?: string | null;
  linkedin_urn?: string | null;
  industry?: string | null;
  headcount_range?: string | null;
  headcount_exact?: number | null;
  description?: string | null;
  tagline?: string | null;
  founded_year?: number | null;
  company_type?: string | null;
  hq_street?: string | null;
  hq_city?: string | null;
  hq_state?: string | null;
  hq_postal_code?: string | null;
  hq_country?: string | null;
  logo_url?: string | null;
  logo_url_cached?: string | null;
  id?: string | number | null;
  linkedin_id?: string | number | null;
};

export type TwentyRecord = Record<string, unknown> & { id: string };

export type PatchResult = {
  patch: Record<string, unknown>;
  written: string[]; // fields that get a value
  kept: string[]; // Generect had a value, the record already had one: left untouched
  missing: string[]; // target fields this workspace does not have (skipped, not an error)
};

type Composite = Record<string, unknown> | null | undefined;

const sub = (record: TwentyRecord, field: string, key: string): unknown =>
  (record[field] as Composite)?.[key];

class PatchBuilder {
  result: PatchResult = { patch: {}, written: [], kept: [], missing: [] };
  constructor(
    private record: TwentyRecord,
    private schema: ObjectSchema,
  ) {}

  // Scalar field filled only when empty.
  scalar(field: string, value: unknown, types: string[] = ['String']) {
    if (value === null || value === undefined || value === '') return;
    if (!hasField(this.schema, field, ...types)) {
      this.result.missing.push(field);
      return;
    }
    if (!isEmpty(this.record[field])) {
      if (this.record[field] !== value) this.result.kept.push(field);
      return;
    }
    this.result.patch[field] = value;
    this.result.written.push(field);
  }

  // Links field (primaryLinkUrl) filled only when empty.
  link(field: string, url: string | null) {
    if (!url) return;
    if (!hasField(this.schema, field, 'Links')) {
      this.result.missing.push(field);
      return;
    }
    const current = sub(this.record, field, 'primaryLinkUrl');
    if (!isEmpty(current)) {
      const same = (u: unknown) => String(u).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      if (same(current) !== same(url)) this.result.kept.push(field);
      return;
    }
    this.result.patch[field] = { primaryLinkUrl: url };
    this.result.written.push(field);
  }

  // Address filled only when the whole address is empty, and only with a country plus a city or state.
  address(field: string, parts: { street?: unknown; city?: unknown; state?: unknown; postcode?: unknown; country?: unknown }) {
    const country = nonEmptyString(parts.country);
    const city = nonEmptyString(parts.city);
    const state = nonEmptyString(parts.state);
    if (!country || (!city && !state)) return;
    if (!hasField(this.schema, field, 'Address')) {
      this.result.missing.push(field);
      return;
    }
    const current = (this.record[field] as Composite) ?? {};
    const hasAny = ['addressStreet1', 'addressCity', 'addressState', 'addressPostcode', 'addressCountry'].some(
      (k) => !isEmpty(current[k]),
    );
    if (hasAny) {
      this.result.kept.push(field);
      return;
    }
    const value: Record<string, string> = { addressCountry: country };
    if (city) value.addressCity = city;
    if (state) value.addressState = state;
    const street = nonEmptyString(parts.street);
    if (street) value.addressStreet1 = street;
    const postcode = nonEmptyString(parts.postcode);
    if (postcode) value.addressPostcode = postcode;
    this.result.patch[field] = value;
    this.result.written.push(field);
  }

  // Always rewritten (not user data).
  always(field: string, value: unknown, types: string[]) {
    if (!hasField(this.schema, field, ...types)) return;
    this.result.patch[field] = value;
  }
}

const splitFullName = (full: string | null): { first: string | null; last: string | null } => {
  if (!full) return { first: null, last: null };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? null, last: null };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

export const hasCurrentPosition = (lead: GenerectLead): boolean =>
  lead.has_current_position !== false && lead.is_current !== false && lead.company_still_working !== false;

const joinLocation = (...parts: unknown[]): string | null => {
  const clean = parts.map(nonEmptyString).filter((p): p is string => p !== null);
  return clean.length ? [...new Set(clean)].join(', ') : null;
};

// Fields the "already complete" check looks at (twitter left out on purpose, like the plugin).
export const PERSON_TARGET_FIELDS = [
  'name',
  'jobTitle',
  'linkedinLink',
  'generectHeadline',
  'generectLocation',
  'generectCompanyName',
  'generectIndustry',
  'generectLeadId',
];

export const COMPANY_TARGET_FIELDS = [
  'name',
  'domainName',
  'linkedinLink',
  'generectIndustry',
  'generectHeadcountRange',
  'generectDescription',
  'generectHqLocation',
  'generectCompanyId',
];

export const PERSON_READ_FIELDS = [
  'name',
  'emails',
  'linkedinLink',
  'jobTitle',
  'description',
  'twitter',
  'city',
  'primaryLocation',
  'attioRecordId',
  'generectStatus',
  'generectInputHash',
  'generectLastAttemptAt',
  'generectMessage',
  'generectHeadline',
  'generectLocation',
  'generectCompanyName',
  'generectIndustry',
  'generectLeadId',
];

export const COMPANY_READ_FIELDS = [
  'name',
  'domainName',
  'linkedinLink',
  'address',
  'employees',
  'employeeRange',
  'industry',
  'description',
  'tagline',
  'foundationDate',
  'logoUrl',
  'attioRecordId',
  'generectStatus',
  'generectInputHash',
  'generectLastAttemptAt',
  'generectMessage',
  'generectIndustry',
  'generectHeadcountRange',
  'generectHeadcount',
  'generectFoundedYear',
  'generectCompanyType',
  'generectDescription',
  'generectHqLocation',
  'generectCompanyId',
  'generectDomain',
];

const valueIsEmpty = (record: TwentyRecord, field: string): boolean => {
  const v = record[field];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (field === 'name' && 'firstName' in (v as object)) {
      return isEmpty((v as Composite)?.firstName) || isEmpty((v as Composite)?.lastName);
    }
    return Object.values(v as object).every(isEmpty);
  }
  return isEmpty(v);
};

// True when every target field that exists in this workspace already has a value: no lookup needed.
export const isRecordComplete = (record: TwentyRecord, schema: ObjectSchema, targets: string[]): boolean => {
  const present = targets.filter((f) => hasField(schema, f));
  return present.length > 0 && present.every((f) => !valueIsEmpty(record, f));
};

export const buildPersonPatch = (record: TwentyRecord, lead: GenerectLead, schema: ObjectSchema): PatchResult => {
  const b = new PatchBuilder(record, schema);

  // name: only the empty halves, never overwritten
  const split = splitFullName(nonEmptyString(lead.full_name));
  const first = nonEmptyString(lead.first_name) ?? split.first;
  const last = nonEmptyString(lead.last_name) ?? split.last;
  if (first || last) {
    if (!hasField(schema, 'name', 'FullName')) b.result.missing.push('name');
    else {
      const curFirst = nonEmptyString(sub(record, 'name', 'firstName'));
      const curLast = nonEmptyString(sub(record, 'name', 'lastName'));
      const next = { firstName: curFirst ?? first ?? '', lastName: curLast ?? last ?? '' };
      if ((!curFirst && first) || (!curLast && last)) {
        b.result.patch.name = next;
        b.result.written.push('name');
      } else if (curFirst || curLast) b.result.kept.push('name');
    }
  }

  const jobTitle = nonEmptyString(lead.job_title);
  if (jobTitle && hasCurrentPosition(lead)) b.scalar('jobTitle', truncate(jobTitle, 250));

  b.link('linkedinLink', normalizeLinkedinPersonUrl(lead.linkedin_url));

  const headline = nonEmptyString(lead.headline);
  // custom fields some workspaces have; skipped elsewhere
  if (headline) b.scalar('description', truncate(headline, 500));
  b.scalar('twitter', nonEmptyString(lead.twitter_link));
  b.scalar('city', nonEmptyString(lead.location_city));
  b.address('primaryLocation', { city: lead.location_city, state: lead.location_state, country: lead.location_country });

  // app-owned fields
  if (headline) b.scalar('generectHeadline', truncate(headline, 500));
  b.scalar(
    'generectLocation',
    nonEmptyString(lead.location_name) ?? joinLocation(lead.location_city, lead.location_state, lead.location_country),
  );
  b.scalar('generectCompanyName', nonEmptyString(lead.company_name));
  b.scalar('generectIndustry', nonEmptyString(lead.industry) ?? nonEmptyString(lead.company_industry));
  b.scalar('generectLeadId', nonEmptyString(lead.id) ?? nonEmptyString(lead.sales_id) ?? nonEmptyString(lead.linkedin_id));
  b.always('generectRaw', lead, ['JSON', 'RawJSONScalar']);
  return b.result;
};

// "51-200" -> [51, 200]; "10001+" -> [10001, Infinity]; "N_251_1K" -> [251, 1000]; "N_100K" -> [100000, Infinity]
const parseCount = (token: string): number | null => {
  const m = /^(\d+(?:\.\d+)?)([KM]?)$/i.exec(token.trim().replace(/,/g, ''));
  if (!m) return null;
  const mult = m[2].toUpperCase() === 'K' ? 1000 : m[2].toUpperCase() === 'M' ? 1_000_000 : 1;
  return Math.round(Number(m[1]) * mult);
};

export const parseRange = (value: string): [number, number] | null => {
  const v = value.trim();
  const plus = /^([\d.,]+[KM]?)\s*\+$/i.exec(v);
  if (plus) {
    const lo = parseCount(plus[1]);
    return lo === null ? null : [lo, Infinity];
  }
  const parts = v.replace(/^N_/i, '').split(/\s*[-_–]\s*/);
  if (parts.length === 1) {
    const n = parseCount(parts[0]);
    if (n === null) return null;
    return /^N_/i.test(v) ? [n, Infinity] : [n, n];
  }
  if (parts.length === 2) {
    const lo = parseCount(parts[0]);
    const hi = parseCount(parts[1]);
    return lo === null || hi === null ? null : [lo, hi];
  }
  return null;
};

// The enum bucket that fully contains the Generect range, or null when the range straddles buckets.
export const pickEmployeeBucket = (
  headcountRange: string | null | undefined,
  headcountExact: number | null | undefined,
  enumValues: string[],
): string | null => {
  let range: [number, number] | null = null;
  if (typeof headcountExact === 'number' && headcountExact > 0) range = [headcountExact, headcountExact];
  else if (headcountRange) range = parseRange(headcountRange);
  if (!range) return null;
  for (const value of enumValues) {
    const bucket = parseRange(value);
    if (bucket && bucket[0] <= range[0] && range[1] <= bucket[1]) return value;
  }
  return null;
};

export type GuardVerdict = { ok: true } | { ok: false; reason: string };

// Domain-mismatch guard. Looked up by the record's own LinkedIn page: block only when both domains
// are known and differ. Looked up by domain: Generect's domain must equal the record's domain.
export const checkCompanyDomain = (
  lookupKind: 'linkedin_url' | 'domain',
  recordDomain: string | null,
  company: GenerectCompany,
): GuardVerdict => {
  const generectDomain = normalizeDomain(company.domain) ?? normalizeDomain(company.website);
  if (lookupKind === 'linkedin_url') {
    if (recordDomain && generectDomain && recordDomain !== generectDomain) {
      return { ok: false, reason: `record domain ${recordDomain} ≠ Generect domain ${generectDomain}` };
    }
    return { ok: true };
  }
  if (!generectDomain) return { ok: false, reason: `Generect returned no domain for ${recordDomain}` };
  if (generectDomain !== recordDomain) {
    return { ok: false, reason: `looked up ${recordDomain}, Generect returned ${generectDomain}` };
  }
  return { ok: true };
};

export const buildCompanyPatch = (record: TwentyRecord, company: GenerectCompany, schema: ObjectSchema): PatchResult => {
  const b = new PatchBuilder(record, schema);
  const domain = normalizeDomain(company.domain) ?? normalizeDomain(company.website);

  b.scalar('name', nonEmptyString(company.name));
  b.link('domainName', domain ? `https://${domain}` : null);
  // the database path returns only linkedin_urn (the /company/<slug> part), the live path linkedin_link
  const urn = nonEmptyString(company.linkedin_urn);
  b.link(
    'linkedinLink',
    normalizeLinkedinCompanyUrl(company.linkedin_link) ??
      (urn && /^[\w%.-]+$/.test(urn) ? `https://www.linkedin.com/company/${urn.toLowerCase()}/` : null),
  );
  b.address('address', {
    street: company.hq_street,
    city: company.hq_city,
    state: company.hq_state,
    postcode: company.hq_postal_code,
    country: company.hq_country,
  });

  const exact = typeof company.headcount_exact === 'number' && company.headcount_exact > 0 ? company.headcount_exact : null;
  // stock Twenty "employees" is a number: only an exact headcount, never a number invented from a range
  if (exact) b.scalar('employees', exact, ['Float', 'Int']);
  const rangeType = schema.readable.employeeRange;
  if (rangeType && schema.enums[rangeType]) {
    const bucket = pickEmployeeBucket(company.headcount_range, exact, schema.enums[rangeType]);
    if (bucket) b.scalar('employeeRange', bucket, [rangeType]);
  }

  b.scalar('industry', nonEmptyString(company.industry));
  const description = nonEmptyString(company.description) ?? nonEmptyString(company.tagline);
  if (description) b.scalar('description', truncate(description, 1000));
  b.scalar('tagline', nonEmptyString(company.tagline));
  const year = Number(company.founded_year);
  if (Number.isInteger(year) && year > 1600 && year < 2200) b.scalar('foundationDate', `${year}-01-01`, ['Date']);
  b.scalar('logoUrl', nonEmptyString(company.logo_url_cached) ?? nonEmptyString(company.logo_url));

  // app-owned fields
  b.scalar('generectIndustry', nonEmptyString(company.industry));
  b.scalar('generectHeadcountRange', nonEmptyString(company.headcount_range));
  if (exact) b.scalar('generectHeadcount', exact, ['Float', 'Int']);
  if (Number.isInteger(year) && year > 1600) b.scalar('generectFoundedYear', year, ['Float', 'Int']);
  b.scalar('generectCompanyType', nonEmptyString(company.company_type));
  if (description) b.scalar('generectDescription', truncate(description, 2000));
  b.scalar('generectHqLocation', joinLocation(company.hq_city, company.hq_state, company.hq_country));
  b.scalar('generectCompanyId', nonEmptyString(company.linkedin_id) ?? nonEmptyString(company.id));
  b.scalar('generectDomain', domain);
  b.always('generectRaw', company, ['JSON', 'RawJSONScalar']);
  return b.result;
};
