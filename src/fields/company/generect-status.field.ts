import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { FIELDS, STATUS_OPTION_IDS } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELDS.company.generectStatus,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'generectStatus',
  label: 'Generect Status',
  description: 'Outcome of the latest Generect enrichment attempt.',
  icon: 'IconProgressCheck',
  isNullable: true,
  options: [
    { id: STATUS_OPTION_IDS.company.MATCHED, value: 'MATCHED', label: 'Matched', color: 'green', position: 0 },
    { id: STATUS_OPTION_IDS.company.COMPLETE, value: 'COMPLETE', label: 'Already complete', color: 'turquoise', position: 1 },
    { id: STATUS_OPTION_IDS.company.NO_MATCH, value: 'NO_MATCH', label: 'No match', color: 'gray', position: 2 },
    { id: STATUS_OPTION_IDS.company.MISMATCH, value: 'MISMATCH', label: 'Domain mismatch', color: 'orange', position: 3 },
    { id: STATUS_OPTION_IDS.company.NO_IDENTIFIER, value: 'NO_IDENTIFIER', label: 'No identifier', color: 'gray', position: 4 },
    { id: STATUS_OPTION_IDS.company.INSUFFICIENT_CREDITS, value: 'INSUFFICIENT_CREDITS', label: 'Out of credits', color: 'red', position: 5 },
    { id: STATUS_OPTION_IDS.company.WRITE_FAILED, value: 'WRITE_FAILED', label: 'Write failed', color: 'red', position: 6 },
    { id: STATUS_OPTION_IDS.company.ERROR, value: 'ERROR', label: 'Error', color: 'red', position: 7 },
  ],
});
