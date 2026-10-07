import {
  defineCommandMenuItem,
  isSelectAll,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { COMMAND_MENU_ITEMS, FRONT_COMPONENTS } from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: COMMAND_MENU_ITEMS.enrichCompanies,
  label: 'Enrich with Generect',
  shortLabel: 'Enrich',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  frontComponentUniversalIdentifier: FRONT_COMPONENTS.enrichCompanies,
  // "Select all" gives the component no concrete ids (and could mean thousands of paid lookups): hidden.
  conditionalAvailabilityExpression: !isSelectAll,
});
