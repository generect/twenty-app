import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.person.generectCompanyName,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectCompanyName',
  label: 'Current Company (Generect)',
  description: 'Current employer name per Generect (the app never creates or relinks companies).',
  icon: 'IconBuildingSkyscraper',
  isNullable: true,
});
