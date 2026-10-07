import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.person.generectIndustry,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectIndustry',
  label: 'Industry (Generect)',
  description: 'Industry of the person\'s profile.',
  icon: 'IconBuildingFactory2',
  isNullable: true,
});
