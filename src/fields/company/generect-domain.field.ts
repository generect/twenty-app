import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectDomain,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectDomain',
  label: 'Domain (Generect)',
  description: 'Domain Generect has for this company (used by the domain-mismatch guard).',
  icon: 'IconWorld',
  isNullable: true,
});
