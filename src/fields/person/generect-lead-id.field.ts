import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.person.generectLeadId,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectLeadId',
  label: 'Generect Lead ID',
  description: 'Generect id of the matched profile (allows a cheaper re-enrich by id later).',
  icon: 'IconId',
  isNullable: true,
});
