// Shared handler of the two ways in: the "Enrich with Generect" command (HTTP route) and the workflow step.

import { GenerectConfigError, runEnrichment } from 'src/logic-functions/core/enrich';
import { type ObjectKind } from 'src/logic-functions/core/twenty-api';

export const MAX_RECORDS_PER_RUN = 50;

type RecordsPayload = { recordIds?: unknown; records?: unknown };

// The route's event carries the button's JSON in `body`; a workflow step passes its inputs ({ recordIds }) directly.
export const isWorkflowRun = (input: unknown): boolean => !(input && typeof input === 'object' && 'body' in (input as object));

// Ids from either: the button sends { recordIds: [...] }, a workflow passes record objects or ids.
export const extractRecordIds = (input: unknown): string[] => {
  const body = (isWorkflowRun(input) ? input : (input as { body: unknown }).body) as RecordsPayload | null;
  const raw = body?.recordIds ?? body?.records;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map((item) => (typeof item === 'string' ? item : (item as { id?: unknown })?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
};

// A workflow runs unattended (e.g. "when a person is created"), so it gets automation's rules: a paid lookup whose
// CRM write failed is never repeated, and errors wait 7 days. A click may retry at once.
export const handleRun = async (kind: ObjectKind, input: unknown) => {
  const recordIds = extractRecordIds(input);
  if (recordIds.length === 0) return { total: 0, summary: 'Generect: no records selected', results: [] };
  try {
    return await runEnrichment(kind, recordIds, isWorkflowRun(input) ? 'auto' : 'manual', {
      runAs: 'user',
      maxRecords: MAX_RECORDS_PER_RUN,
    });
  } catch (error) {
    if (error instanceof GenerectConfigError) return { total: recordIds.length, summary: error.message, error: 'NO_API_KEY', results: [] };
    throw error;
  }
};
