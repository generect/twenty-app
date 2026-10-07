import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectLastAttemptAt,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.DATE_TIME,
  name: 'generectLastAttemptAt',
  label: 'Generect Last Attempt',
  description: 'When the app last looked this record up (match or not).',
  icon: 'IconClockSearch',
  isNullable: true,
});
