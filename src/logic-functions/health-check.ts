import { type ApplicationHealthCheckResult, defineHealthCheck } from 'twenty-sdk/define';

import { LOGIC_FUNCTIONS } from 'src/constants/universal-identifiers';
import { readVariable } from 'src/logic-functions/core/util';

// A banner on the app's settings page. No network call: Generect has no free endpoint to test a key, and a lookup
// may cost money. A wrong key shows on the first run instead ("Generect rejected the API key").
export const healthCheck = (env: Record<string, string | undefined> = process.env): ApplicationHealthCheckResult => {
  const key = readVariable(env.GENERECT_API_KEY);
  if (!key) {
    return {
      status: 'WARNING',
      title: 'Add your Generect API key',
      description:
        'The app does nothing until a workspace admin pastes a key from app.generect.com → Settings → API into this page. Keys starting with test_ return sample data for $0.',
    };
  }
  if (key.startsWith('test_')) {
    return {
      status: 'INFO',
      title: 'Test mode',
      description: 'This is a test_ key: lookups return sample data and cost $0. Paste a live key to enrich real records.',
    };
  }
  return { status: 'OK' };
};

export default defineHealthCheck({
  universalIdentifier: LOGIC_FUNCTIONS.healthCheck.universalIdentifier,
  name: 'generect-health-check',
  description: 'Shows on the settings page whether a Generect API key is set and whether it is a test key.',
  timeoutSeconds: 10,
  handler: () => healthCheck(),
});
