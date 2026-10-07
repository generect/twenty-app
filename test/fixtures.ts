import { type ObjectSchema } from 'src/logic-functions/core/schema';

// Schemas shaped like a customised workspace (extra custom fields from a CRM sync) and like stock Twenty.
const t = (fields: Record<string, string>, writable?: string[]): ObjectSchema => ({
  readable: fields,
  writable: new Set(writable ?? Object.keys(fields).filter((f) => f !== 'id')),
  enums: {},
});

const COMMON = {
  id: 'UUID',
  generectStatus: 'PersonGenerectStatusEnum',
  generectEnrichedAt: 'DateTime',
  generectLastAttemptAt: 'DateTime',
  generectInputHash: 'String',
  generectMessage: 'String',
  generectRaw: 'JSON',
};

export const OUR_PERSON_SCHEMA: ObjectSchema = t({
  ...COMMON,
  name: 'FullName',
  emails: 'Emails',
  linkedinLink: 'Links',
  jobTitle: 'String',
  description: 'String',
  twitter: 'String',
  primaryLocation: 'Address',
  attioRecordId: 'String',
  generectHeadline: 'String',
  generectLocation: 'String',
  generectCompanyName: 'String',
  generectIndustry: 'String',
  generectLeadId: 'String',
});

export const STOCK_PERSON_SCHEMA: ObjectSchema = t({
  ...COMMON,
  name: 'FullName',
  emails: 'Emails',
  linkedinLink: 'Links',
  jobTitle: 'String',
  generectHeadline: 'String',
  generectLocation: 'String',
  generectCompanyName: 'String',
  generectIndustry: 'String',
  generectLeadId: 'String',
});

export const OUR_COMPANY_SCHEMA: ObjectSchema = {
  ...t({
    ...COMMON,
    generectStatus: 'CompanyGenerectStatusEnum',
    name: 'String',
    domainName: 'Links',
    linkedinLink: 'Links',
    address: 'Address',
    industry: 'String',
    description: 'String',
    foundationDate: 'Date',
    logoUrl: 'String',
    employeeRange: 'CompanyEmployeeRangeEnum',
    attioRecordId: 'String',
    generectIndustry: 'String',
    generectHeadcountRange: 'String',
    generectHeadcount: 'Float',
    generectFoundedYear: 'Float',
    generectCompanyType: 'String',
    generectDescription: 'String',
    generectHqLocation: 'String',
    generectCompanyId: 'String',
    generectDomain: 'String',
  }),
  enums: {
    CompanyEmployeeRangeEnum: ['N_1_10', 'N_11_50', 'N_51_250', 'N_251_1K', 'N_1K_5K', 'N_5K_10K', 'N_10K_50K', 'N_50K_100K', 'N_100K'],
    CompanyGenerectStatusEnum: ['MATCHED', 'COMPLETE', 'NO_MATCH', 'MISMATCH', 'NO_IDENTIFIER', 'INSUFFICIENT_CREDITS', 'WRITE_FAILED', 'ERROR'],
  },
};

// Payloads as returned by api.generect.com with a test_ key (27.09.2026).
export const LEAD = {
  full_name: 'Rafael Testwell',
  first_name: 'Rafael',
  last_name: 'Testwell',
  headline: 'Account Executive at Sandbox Robotics',
  job_title: 'Account Executive',
  is_current: true,
  company_still_working: true,
  linkedin_url: 'https://www.linkedin.com/in/sandbox-rafael-testwell-asbjxx',
  linkedin_id: 'ACwAAARQPraiLtgLuy3rhj9heH52Z1XHmAsBJXX',
  sales_id: null,
  twitter_link: null,
  location_name: 'Austin, United States',
  location_city: 'Austin',
  location_state: 'Texas',
  location_country: 'United States',
  company_name: 'Sandbox Robotics',
  industry: 'Industrial Machinery Manufacturing',
};

export const COMPANY = {
  name: 'Northwind Analytics',
  website: 'https://northwind-analytics.example.com',
  domain: 'northwind-analytics.example.com',
  industry: 'Data Infrastructure and Analytics',
  headcount_range: '501-1000',
  headcount_exact: 640,
  hq_country: 'United Kingdom',
  hq_state: 'England',
  hq_city: 'London',
  hq_postal_code: null,
  hq_street: null,
  tagline: 'Warehouse-native product analytics.',
  description: 'Warehouse-native product analytics. Fictional company.',
  company_type: 'Privately Held',
  founded_year: 2011,
  linkedin_link: 'https://www.linkedin.com/company/northwind-analytics-test/',
  linkedin_id: '900087670',
  logo_url: null,
};
