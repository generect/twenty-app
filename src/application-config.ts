import { defineApplication, FieldType } from 'twenty-sdk/define';

import { APP_VARIABLE_IDS, APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The marketplace card and detail page come from here; the About tab is the README (the SDK copies it in at build).
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Generect',
  description:
    'Enrich People and Companies with Generect B2B data: LinkedIn profile, job title, location, industry, headcount, HQ. Fills empty fields only and never overwrites your data.',
  author: 'Generect',
  category: 'Enrichment',
  logo: 'public/generect-logo.svg',
  galleryImages: ['public/gallery/enriched-person.png', 'public/gallery/enrich-command.png', 'public/gallery/enriched-company.png'],
  websiteUrl: 'https://generect.com',
  termsUrl: 'https://generect.com/terms',
  emailSupport: 'support@generect.com',
  issueReportUrl: 'https://github.com/generect/twenty-app/issues',
  billing: {
    // Free text only: Generect bills your own Generect account, nothing is charged in Twenty credits by the app.
    description:
      'Pay Generect per match with your own API key: $0.02 per enriched record, $0 when nothing is found. Optional live LinkedIn lookups cost $0.04. Keys starting with test_ return sample data for $0.',
  },
  // Per-workspace configuration: every installing workspace brings its own key and choices.
  // Secret variables are encrypted per workspace and only reach logic functions, never the browser.
  applicationVariables: {
    GENERECT_API_KEY: {
      universalIdentifier: APP_VARIABLE_IDS.GENERECT_API_KEY,
      label: 'Generect API key',
      description:
        'From app.generect.com → Settings → API. Keys starting with test_ return sample data for $0. Without a key the app does nothing.',
      isSecret: true,
      isRequired: true,
    },
    REALTIME_LINKEDIN_LOOKUPS: {
      universalIdentifier: APP_VARIABLE_IDS.REALTIME_LINKEDIN_LOOKUPS,
      label: 'Live LinkedIn lookups (double price)',
      description:
        'Off by default: lookups use Generect\'s database ($0.02 per match, $0 per miss; data refreshed within 60 days). On: LinkedIn-URL lookups always fetch live ($0.04). Email lookups never use live mode.',
      type: FieldType.BOOLEAN,
      value: false,
    },
    MAX_SPEND_PER_RUN_USD: {
      universalIdentifier: APP_VARIABLE_IDS.MAX_SPEND_PER_RUN_USD,
      label: 'Spend cap per run, USD',
      description: 'One click or one workflow run stops before spending more than this. Default 5; 0 = no paid lookups.',
      type: FieldType.NUMBER,
      value: 5,
    },
  },
});
