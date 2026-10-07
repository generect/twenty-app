import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectHqLocation,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectHqLocation',
  label: 'HQ (Generect)',
  description: 'Headquarters city, state, country.',
  icon: 'IconMapPin',
  isNullable: true,
});
