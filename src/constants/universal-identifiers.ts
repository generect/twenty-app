// Universal identifiers: generated once, NEVER change them after a release.
// Changing one makes Twenty treat the entity as deleted + recreated (data loss for fields).

export const APPLICATION_UNIVERSAL_IDENTIFIER = '7b9816ed-ce4e-4c14-87ad-8a3066e99696';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '3a1a8224-1441-4e63-9502-a3762b10c3d1';

export const APP_VARIABLE_IDS = {
  GENERECT_API_KEY: 'd857006d-ed6c-44be-819c-1247ed0d4a86',
  REALTIME_LINKEDIN_LOOKUPS: 'f4841e68-b92a-4b30-8826-db63dea7454c',
  MAX_SPEND_PER_RUN_USD: 'bc462d19-4051-4bb9-94b0-787e0793896f',
} as const;

export const LOGIC_FUNCTIONS = {
  enrichPeopleRoute: { universalIdentifier: 'a1d47a80-9dca-4fb3-8c7a-650ea81ea4a8', path: '/generect/enrich-people' },
  enrichCompaniesRoute: { universalIdentifier: 'c8be04dd-6300-40ef-bddf-0595a61d2c37', path: '/generect/enrich-companies' },
  healthCheck: { universalIdentifier: 'f2a6c1d4-8b3e-4f57-9c21-6e0d4b7a9e38' },
} as const;

// Retired in 1.0 with the automatic mode (database triggers that ran, and were billed, on every record created or
// updated, even with the mode off): never reuse these ids. Automation is a workflow with the "Enrich ... with
// Generect" step now. Variables AUTO_ENRICH_MODE ebaf1ee2-7ec4-4fd7-90f8-e0ec6b35d826, AUTO_ENRICH_SKIP_API_CREATED
// 49f60a97-6d85-40cd-8967-0d0731b30341; functions a6ffdf27-bcd4-4d2d-977f-2f08105a73f7, 97b6dd27-db21-4421-8a4b-2d100a032186,
// e08656df-023c-4cb3-a77a-1c89dfcd1172, 6fb62410-26c6-4534-8200-5d8cd91bf170.

export const FRONT_COMPONENTS = {
  enrichPeople: 'fdb486af-9209-4a4a-a43d-221bb6571999',
  enrichCompanies: 'd5aeef79-78ef-4e08-b960-7c8df80ad2bb',
} as const;

export const COMMAND_MENU_ITEMS = {
  enrichPeople: 'cca6b105-2da2-41aa-a199-84d36770b66c',
  enrichCompanies: '119ee269-3c38-4df4-9b8d-ce5e69219c47',
} as const;

export const FIELDS = {
  'person': {
    'generectStatus': '3f2ed060-049c-440a-b683-9ea5adb41af2',
    'generectEnrichedAt': '60e2953f-3262-4b13-b726-5d4c85a06210',
    'generectLastAttemptAt': '4baf6397-3841-4f91-b958-d85ae47ababa',
    'generectInputHash': 'ad14a52c-e22a-457e-9a67-ec45f8b81521',
    'generectMessage': '0db1662d-11f3-4222-b10d-271a44b3953f',
    'generectHeadline': '2e2b5812-9136-4885-9e1c-8742dc320175',
    'generectLocation': '08ce4de2-f884-4e33-b352-83bb0072424e',
    'generectCompanyName': 'b1e8cbae-4a94-4198-9b10-c389f34951fe',
    'generectIndustry': '3e45cbbd-5950-43bf-8f1f-11fd174c35ec',
    'generectLeadId': '89962322-f28c-44a4-a088-37ece297b780',
    'generectRaw': '05ef7d8f-779f-4901-84ae-61bce665d181'
  },
  'company': {
    'generectStatus': 'bf3c4643-d78a-4f2c-96ae-16b2f51f4108',
    'generectEnrichedAt': '131834b6-88bb-4a5a-a0ad-38f9afbfd689',
    'generectLastAttemptAt': 'b5ac7d4d-881e-42e6-bcbf-31eb6e82ad1d',
    'generectInputHash': '3b78ffce-3dca-4e78-a2a8-4b60d9ac1f93',
    'generectMessage': 'e3b8049d-da8a-4d58-9c9f-cf42215852f0',
    'generectIndustry': 'fc4216c0-a705-4642-9c29-edb6c32e8f75',
    'generectHeadcountRange': 'f467f431-1bab-4fde-b61c-908d33c6e2d8',
    'generectHeadcount': '6326d2eb-70c5-49a4-a60e-cf037b952d82',
    'generectFoundedYear': 'b3d63fff-863f-4159-9344-4c0ae523b720',
    'generectCompanyType': '92ec352c-8f35-4679-83be-2e69881f03f2',
    'generectDescription': 'dfa0e35b-463d-42f3-93f4-49e7a5ed6762',
    'generectHqLocation': '3f46dbfb-0856-4b3a-859f-07f56d757ee7',
    'generectCompanyId': '0e45865f-55ff-44f3-98b9-35aaf3f8a654',
    'generectDomain': '9b310de2-4099-49ee-a986-fb5a9634fc11',
    'generectRaw': 'f7a5031e-aa1a-43cf-b5a9-41fd06558cd0'
  }
} as const;

export const STATUS_OPTION_IDS = {
  'person': {
    'MATCHED': '44712a8b-6e44-4fa3-97a2-8910d62d4808',
    'COMPLETE': '576dc93f-90d4-4ccf-bd68-ad703eaa4cc3',
    'NO_MATCH': '51208452-d9d0-499e-ad9f-7abc78861686',
    'NO_IDENTIFIER': '4c07efea-a6cb-4694-a0ff-f2272ea499e5',
    'INSUFFICIENT_CREDITS': '8710e9e1-5b0e-4f73-8987-fd4b62df1be5',
    'WRITE_FAILED': '171ec419-4714-4ce8-85fb-973f2aa8d1fa',
    'ERROR': 'ae1eb79c-4a33-4907-b789-ba82eeaac6ee'
  },
  'company': {
    'MATCHED': '1a004d90-7439-4fff-b645-4480e953707a',
    'COMPLETE': '6c4575a9-382b-4d00-a64d-779b810d76a1',
    'NO_MATCH': '4adb2765-4718-4d7f-8884-994bf79b4e39',
    'MISMATCH': '1fdc98cd-40d3-481c-ac89-2f154d76455f',
    'NO_IDENTIFIER': '08184914-61d6-4163-8397-b9a570128e0d',
    'INSUFFICIENT_CREDITS': 'd3000e12-fdf6-43e0-b475-4f3f907da04b',
    'WRITE_FAILED': '94ff3f9b-085c-48d5-a83f-141e8958a218',
    'ERROR': '7654f047-9b2f-49da-8ea8-56c1164fb5d6'
  }
} as const;
