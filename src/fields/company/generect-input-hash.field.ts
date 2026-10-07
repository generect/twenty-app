import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectInputHash,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectInputHash',
  label: 'Generect Input Hash',
  description: 'Hash of the identifier used for the last lookup; unchanged input is not re-enriched automatically.',
  icon: 'IconHash',
  isNullable: true,
});
