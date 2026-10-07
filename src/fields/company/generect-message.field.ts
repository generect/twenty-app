import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectMessage,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'generectMessage',
  label: 'Generect Result',
  description: 'Human-readable summary of the last attempt: fields written, kept, cost.',
  icon: 'IconMessage',
  isNullable: true,
});
