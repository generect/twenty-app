import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';

import { FRONT_COMPONENTS, LOGIC_FUNCTIONS } from 'src/constants/universal-identifiers';
import { runEnrichment } from 'src/front-components/utils/run-enrichment';

const EnrichPeople = () => {
  const recordIds = useSelectedRecordIds();
  return <Command execute={() => runEnrichment(LOGIC_FUNCTIONS.enrichPeopleRoute.path, recordIds)} />;
};

export default defineFrontComponent({
  universalIdentifier: FRONT_COMPONENTS.enrichPeople,
  name: 'generect-enrich-people',
  description: 'Headless: sends the selected people to the Generect enrich route',
  isHeadless: true,
  component: EnrichPeople,
});
