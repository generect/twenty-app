import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';

import { FRONT_COMPONENTS, LOGIC_FUNCTIONS } from 'src/constants/universal-identifiers';
import { runEnrichment } from 'src/front-components/utils/run-enrichment';

const EnrichCompanies = () => {
  const recordIds = useSelectedRecordIds();
  return <Command execute={() => runEnrichment(LOGIC_FUNCTIONS.enrichCompaniesRoute.path, recordIds)} />;
};

export default defineFrontComponent({
  universalIdentifier: FRONT_COMPONENTS.enrichCompanies,
  name: 'generect-enrich-companies',
  description: 'Headless: sends the selected companies to the Generect enrich route',
  isHeadless: true,
  component: EnrichCompanies,
});
