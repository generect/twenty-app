import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectHeadcountRange,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectHeadcountRange',
  label: 'Headcount Range (Generect)',
  description: 'LinkedIn headcount bucket, e.g. 51-200.',
  icon: 'IconUsers',
  isNullable: true,
});
