import { defineLogicFunction, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { LOGIC_FUNCTIONS } from 'src/constants/universal-identifiers';
import { handleRun } from 'src/logic-functions/core/triggers';

// POST /s/generect/enrich-companies — called by the "Enrich with Generect" command (selected companies, max 50 per click)
// and usable as a workflow step. Runs as the clicking user ∩ the app role.
const handler = (input: unknown) => handleRun('company', input);

export default defineLogicFunction({
  universalIdentifier: LOGIC_FUNCTIONS.enrichCompaniesRoute.universalIdentifier,
  name: 'generect-enrich-companies',
  description: 'Enrich the given Company records with Generect (fills empty fields only)',
  timeoutSeconds: 900,
  handler,
  httpRouteTriggerSettings: {
    path: LOGIC_FUNCTIONS.enrichCompaniesRoute.path,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  workflowActionTriggerSettings: {
    label: 'Enrich companies with Generect',
    icon: 'IconSparkles',
    inputSchema: [
      {
        type: 'object',
        properties: {
          recordIds: {
            type: 'records',
            objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
            label: 'Company records',
          },
        },
      },
    ],
  },
});
