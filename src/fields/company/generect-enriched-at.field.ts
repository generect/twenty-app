import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectEnrichedAt,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.DATE_TIME,
  name: 'generectEnrichedAt',
  label: 'Generect Enriched At',
  description: 'When Generect last returned a match for this record.',
  icon: 'IconClock',
  isNullable: true,
});
