import { defineLogicFunction, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { LOGIC_FUNCTIONS } from 'src/constants/universal-identifiers';
import { handleRun } from 'src/logic-functions/core/triggers';

// POST /s/generect/enrich-people — called by the "Enrich with Generect" command (selected people, max 50 per click)
// and usable as a workflow step. Runs as the clicking user ∩ the app role.
const handler = (input: unknown) => handleRun('person', input);

export default defineLogicFunction({
  universalIdentifier: LOGIC_FUNCTIONS.enrichPeopleRoute.universalIdentifier,
  name: 'generect-enrich-people',
  description: 'Enrich the given Person records with Generect (fills empty fields only)',
  timeoutSeconds: 900,
  handler,
  httpRouteTriggerSettings: {
    path: LOGIC_FUNCTIONS.enrichPeopleRoute.path,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  workflowActionTriggerSettings: {
    label: 'Enrich people with Generect',
    icon: 'IconSparkles',
    inputSchema: [
      {
        type: 'object',
        properties: {
          recordIds: {
            type: 'records',
            objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
            label: 'Person records',
          },
        },
      },
    ],
  },
});
