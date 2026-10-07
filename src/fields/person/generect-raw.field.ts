import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.person.generectRaw,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RAW_JSON,
  name: 'generectRaw',
  label: 'Generect Raw Payload',
  description: 'Full lead payload of the last match.',
  icon: 'IconBraces',
  isNullable: true,
  // Large and noisy: keep it out of the timeline.
  isAuditLogged: false,
});
