// Orchestration: read records -> decide -> call Generect -> write only what is empty -> status.

import {
  createGenerectClient,
  type CompanyIdentifier,
  type GenerectClient,
  type GenerectOutcome,
  type LeadIdentifier,
} from 'src/logic-functions/core/generect-client';
import {
  buildCompanyPatch,
  buildPersonPatch,
  checkCompanyDomain,
  COMPANY_READ_FIELDS,
  COMPANY_TARGET_FIELDS,
  isRecordComplete,
  PERSON_READ_FIELDS,
  PERSON_TARGET_FIELDS,
  type GenerectCompany,
  type GenerectLead,
  type PatchResult,
  type TwentyRecord,
} from 'src/logic-functions/core/mapping';
import { hasField, type ObjectSchema } from 'src/logic-functions/core/schema';
import { createTwentyApi, type ObjectKind, type TwentyApi } from 'src/logic-functions/core/twenty-api';
import {
  FREEMAIL_DOMAINS,
  inputHash,
  isEmpty,
  normalizeDomain,
  normalizeEmail,
  normalizeLinkedinCompanyUrl,
  normalizeLinkedinPersonUrl,
  readBooleanVariable,
  readSpendCap,
  readVariable,
  truncate,
} from 'src/logic-functions/core/util';

export type EnrichStatus =
  | 'MATCHED'
  | 'COMPLETE'
  | 'NO_MATCH'
  | 'MISMATCH'
  | 'NO_IDENTIFIER'
  | 'INSUFFICIENT_CREDITS'
  | 'WRITE_FAILED'
  | 'ERROR';

export type RecordOutcome =
  | EnrichStatus
  | 'SKIPPED_UNCHANGED'
  | 'SKIPPED_MIRRORED'
  | 'SKIPPED_RUN_STOPPED'
  | 'RECORD_NOT_FOUND';

export type RecordResult = {
  recordId: string;
  outcome: RecordOutcome;
  amountCharged: number;
  written: string[];
  kept: string[];
  missing: string[];
  message: string;
};

export type RunMode = 'manual' | 'auto';

export type RunResult = {
  kind: ObjectKind;
  mode: RunMode;
  total: number;
  spentUsd: number;
  stoppedReason: string | null;
  counts: Partial<Record<RecordOutcome, number>>;
  results: RecordResult[];
  summary: string;
};

export class GenerectConfigError extends Error {}

const DAY = 24 * 60 * 60 * 1000;

// How long an unchanged record is left alone after each status. 'auto' = an unattended workflow run.
// null = retry immediately.
export const RETRY_WINDOW_MS: Record<RunMode, Record<EnrichStatus, number | null>> = {
  manual: {
    MATCHED: 90 * DAY,
    COMPLETE: 90 * DAY,
    MISMATCH: 90 * DAY,
    NO_MATCH: 30 * DAY,
    NO_IDENTIFIER: null,
    INSUFFICIENT_CREDITS: null,
    WRITE_FAILED: null, // an explicit click may retry; automation never does
    ERROR: null,
  },
  auto: {
    MATCHED: 90 * DAY,
    COMPLETE: 90 * DAY,
    MISMATCH: 90 * DAY,
    NO_MATCH: 30 * DAY,
    NO_IDENTIFIER: null,
    INSUFFICIENT_CREDITS: 7 * DAY,
    WRITE_FAILED: 3650 * DAY, // paid lookup whose CRM write failed: never retried automatically
    ERROR: 7 * DAY,
  },
};

export type Identifier = { kind: 'linkedin_url'; value: string } | { kind: 'email'; value: string } | { kind: 'domain'; value: string };

export const pickPersonIdentifier = (record: TwentyRecord): Identifier | null => {
  const linkedin = normalizeLinkedinPersonUrl((record.linkedinLink as { primaryLinkUrl?: unknown } | null)?.primaryLinkUrl);
  if (linkedin) return { kind: 'linkedin_url', value: linkedin };
  const email = normalizeEmail((record.emails as { primaryEmail?: unknown } | null)?.primaryEmail);
  if (email) return { kind: 'email', value: email };
  return null;
};

export const pickCompanyIdentifier = (record: TwentyRecord): Identifier | null => {
  const linkedin = normalizeLinkedinCompanyUrl((record.linkedinLink as { primaryLinkUrl?: unknown } | null)?.primaryLinkUrl);
  if (linkedin) return { kind: 'linkedin_url', value: linkedin };
  const domain = normalizeDomain((record.domainName as { primaryLinkUrl?: unknown } | null)?.primaryLinkUrl);
  if (domain && !FREEMAIL_DOMAINS.has(domain)) return { kind: 'domain', value: domain };
  return null;
};

export const pickIdentifier = (kind: ObjectKind, record: TwentyRecord) =>
  kind === 'person' ? pickPersonIdentifier(record) : pickCompanyIdentifier(record);

export const identifierHash = (kind: ObjectKind, identifier: Identifier | null): string | null =>
  identifier ? inputHash(`${kind}|${identifier.kind}|${identifier.value}`) : null;

// Skip a record whose lookup input is unchanged and whose last outcome is still fresh.
export const isUnchangedAndFresh = (
  record: TwentyRecord,
  hash: string,
  mode: RunMode,
  now: number,
): boolean => {
  if (record.generectInputHash !== hash) return false;
  const status = record.generectStatus as EnrichStatus | null | undefined;
  if (!status || !(status in RETRY_WINDOW_MS[mode])) return false;
  const window = RETRY_WINDOW_MS[mode][status];
  if (window === null) return false;
  const last = Date.parse(String(record.generectLastAttemptAt ?? ''));
  if (!Number.isFinite(last)) return false;
  return now - last < window;
};

const money = (n: number) => `$${n.toFixed(2)}`;

export const statusData = (
  schema: ObjectSchema,
  status: EnrichStatus,
  message: string,
  hash: string | null,
  nowIso: string,
  matched: boolean,
): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  const statusEnum = schema.readable.generectStatus;
  if (hasField(schema, 'generectStatus') && (!schema.enums[statusEnum] || schema.enums[statusEnum].includes(status))) {
    data.generectStatus = status;
  }
  if (hasField(schema, 'generectLastAttemptAt')) data.generectLastAttemptAt = nowIso;
  if (matched && hasField(schema, 'generectEnrichedAt')) data.generectEnrichedAt = nowIso;
  if (hash && hasField(schema, 'generectInputHash')) data.generectInputHash = hash;
  if (hasField(schema, 'generectMessage')) data.generectMessage = truncate(message, 500);
  return data;
};

export const describePatch = (patch: PatchResult, amount: number): string => {
  const parts = [
    patch.written.length ? `filled ${patch.written.join(', ')}` : 'nothing new to fill',
    patch.kept.length ? `kept existing ${patch.kept.join(', ')}` : null,
    patch.missing.length ? `skipped (field missing or not visible to apps): ${patch.missing.join(', ')}` : null,
    `cost ${money(amount)}`,
  ];
  return parts.filter(Boolean).join('; ');
};

type Deps = {
  api: TwentyApi;
  generect: GenerectClient;
  now?: () => number;
  maxSpendUsd: number;
  maxRecords: number;
  mode: RunMode;
  deadlineMs?: number; // stop starting new lookups after this many ms (function timeout safety)
};

export const enrichRecords = async (kind: ObjectKind, recordIds: string[], deps: Deps): Promise<RunResult> => {
  const now = deps.now ?? Date.now;
  const started = now();
  const ids = [...new Set(recordIds.filter((id) => typeof id === 'string' && id.length > 0))];
  const schema = await deps.api.getSchema(kind);
  const records = await deps.api.readRecords(
    kind,
    ids.slice(0, deps.maxRecords),
    kind === 'person' ? PERSON_READ_FIELDS : COMPANY_READ_FIELDS,
  );
  const byId = new Map(records.map((r) => [r.id, r]));
  const results: RecordResult[] = [];
  let spent = 0;
  let stoppedReason: string | null = null;

  const push = (recordId: string, outcome: RecordOutcome, message: string, extra?: Partial<RecordResult>) =>
    results.push({ recordId, outcome, message, amountCharged: 0, written: [], kept: [], missing: [], ...extra });

  const write = async (id: string, data: Record<string, unknown>) => deps.api.updateRecord(kind, id, data);
  // Status-only writes must not abort the run (the lookup outcome is still reported in the result).
  const statusWriteErrors: string[] = [];
  const writeStatus = async (id: string, data: Record<string, unknown>) => {
    try {
      await write(id, data);
    } catch (error) {
      statusWriteErrors.push(`${id}: ${String((error as Error)?.message ?? error)}`);
    }
  };

  for (const [index, id] of ids.entries()) {
    if (index >= deps.maxRecords) {
      push(id, 'SKIPPED_RUN_STOPPED', `over the per-run limit of ${deps.maxRecords} records`);
      continue;
    }
    if (stoppedReason) {
      push(id, 'SKIPPED_RUN_STOPPED', stoppedReason);
      continue;
    }
    if (deps.deadlineMs && now() - started > deps.deadlineMs) {
      stoppedReason = 'time budget of this run used up; run it again for the rest';
      push(id, 'SKIPPED_RUN_STOPPED', stoppedReason);
      continue;
    }
    const record = byId.get(id);
    if (!record) {
      push(id, 'RECORD_NOT_FOUND', 'record not found or not readable');
      continue;
    }
    const nowIso = new Date(now()).toISOString();

    // An unattended run never touches records another CRM sync owns (one keyed by attioRecordId would overwrite them).
    if (deps.mode === 'auto' && !isEmpty(record.attioRecordId)) {
      push(id, 'SKIPPED_MIRRORED', 'mirrored from Attio (attioRecordId set): automation skips it');
      continue;
    }

    const identifier = pickIdentifier(kind, record);
    if (!identifier) {
      const message =
        kind === 'person'
          ? 'no LinkedIn profile URL (/in/) or email to look up'
          : 'no LinkedIn company URL (/company/) or corporate domain to look up';
      if (record.generectStatus !== 'NO_IDENTIFIER') {
        await writeStatus(id, statusData(schema, 'NO_IDENTIFIER', message, null, nowIso, false));
      }
      push(id, 'NO_IDENTIFIER', message);
      continue;
    }
    const hash = identifierHash(kind, identifier) as string;

    if (isUnchangedAndFresh(record, hash, deps.mode, now())) {
      push(id, 'SKIPPED_UNCHANGED', `same input as the last lookup (${String(record.generectStatus)}); clear "Generect Input Hash" to force`);
      continue;
    }

    if (isRecordComplete(record, schema, kind === 'person' ? PERSON_TARGET_FIELDS : COMPANY_TARGET_FIELDS)) {
      const message = 'every enrichable field already has a value; no lookup made ($0)';
      await writeStatus(id, statusData(schema, 'COMPLETE', message, hash, nowIso, false));
      push(id, 'COMPLETE', message);
      continue;
    }

    const expected = 0.04; // worst case (realtime) so the cap is never overshot
    if (spent + expected > deps.maxSpendUsd + 1e-9) {
      stoppedReason = `spend cap of ${money(deps.maxSpendUsd)} per run reached`;
      push(id, 'SKIPPED_RUN_STOPPED', stoppedReason);
      continue;
    }

    let outcome: GenerectOutcome<Record<string, unknown>>;
    if (kind === 'person') {
      const body = { [identifier.kind]: identifier.value } as LeadIdentifier;
      outcome = await deps.generect.enrichLead(body);
    } else {
      const body = { [identifier.kind]: identifier.value } as CompanyIdentifier;
      outcome = await deps.generect.enrichCompany(body);
    }
    const via = `${identifier.kind === 'linkedin_url' ? 'LinkedIn' : identifier.kind} via ${outcome.endpoint}`;

    if (outcome.kind === 'auth_error') {
      stoppedReason = `Generect rejected the API key (${outcome.detail}); check Settings → Applications → Generect`;
      push(id, 'ERROR', stoppedReason);
      continue;
    }
    if (outcome.kind === 'insufficient_credits') {
      stoppedReason = 'Generect balance is empty (402); run stopped';
      await writeStatus(id, statusData(schema, 'INSUFFICIENT_CREDITS', stoppedReason, hash, nowIso, false));
      push(id, 'INSUFFICIENT_CREDITS', stoppedReason);
      continue;
    }
    if (outcome.kind === 'error') {
      const message = `Generect error ${outcome.status ?? ''} after ${outcome.attempts} attempt(s): ${outcome.detail}`.trim();
      await writeStatus(id, statusData(schema, 'ERROR', message, hash, nowIso, false));
      push(id, 'ERROR', message);
      continue;
    }
    spent += outcome.amountCharged;
    if (outcome.kind === 'no_match') {
      const message = `no match by ${via}; cost ${money(outcome.amountCharged)}`;
      await writeStatus(id, statusData(schema, 'NO_MATCH', message, hash, nowIso, false));
      push(id, 'NO_MATCH', message, { amountCharged: outcome.amountCharged });
      continue;
    }

    // Paid match from here on: whatever happens, never call Generect again for this record in this run, and record
    // WRITE_FAILED with the input hash on any failure, so a later click does not pay for the same lookup again.
    let patch: PatchResult | undefined;
    try {
      if (kind === 'company') {
        const recordDomain = normalizeDomain((record.domainName as { primaryLinkUrl?: unknown } | null)?.primaryLinkUrl);
        const verdict = checkCompanyDomain(identifier.kind as 'linkedin_url' | 'domain', recordDomain, outcome.data as GenerectCompany);
        if (!verdict.ok) {
          const message = `domain mismatch, nothing written: ${verdict.reason}; cost ${money(outcome.amountCharged)}`;
          await writeStatus(id, statusData(schema, 'MISMATCH', message, hash, nowIso, false));
          push(id, 'MISMATCH', message, { amountCharged: outcome.amountCharged });
          continue;
        }
        patch = buildCompanyPatch(record, outcome.data as GenerectCompany, schema);
      } else {
        patch = buildPersonPatch(record, outcome.data as GenerectLead, schema);
      }
      // Hash of the identifier AFTER our write (e.g. an email lookup that fills the LinkedIn URL), so the
      // person.updated / company.updated event our own write causes is recognised as "unchanged".
      const postHash = identifierHash(kind, pickIdentifier(kind, { ...record, ...patch.patch })) ?? hash;
      const message = `matched by ${via}: ${describePatch(patch, outcome.amountCharged)}`;
      await write(id, { ...patch.patch, ...statusData(schema, 'MATCHED', message, postHash, nowIso, true) });
      push(id, 'MATCHED', message, {
        amountCharged: outcome.amountCharged,
        written: patch.written,
        kept: patch.kept,
        missing: patch.missing,
      });
    } catch (error) {
      const failMessage = `paid match (${money(outcome.amountCharged)}) but saving it to the CRM failed: ${String(
        (error as Error)?.message ?? error,
      )}; not retried automatically`;
      try {
        await write(id, statusData(schema, 'WRITE_FAILED', failMessage, hash, nowIso, false));
      } catch {
        // the status write can fail for the same reason; the run result still reports it
      }
      push(id, 'WRITE_FAILED', failMessage, { amountCharged: outcome.amountCharged, missing: patch?.missing ?? [] });
    }
  }

  const counts: Partial<Record<RecordOutcome, number>> = {};
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  const summary = [
    `Generect: ${Object.entries(counts)
      .map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, ' ')}`)
      .join(', ')}`,
    `spent ${money(spent)}`,
    stoppedReason ? `stopped: ${stoppedReason}` : null,
    statusWriteErrors.length ? `status write failed for ${statusWriteErrors.length} record(s)` : null,
  ]
    .filter(Boolean)
    .join('; ');
  return { kind, mode: deps.mode, total: ids.length, spentUsd: Math.round(spent * 10000) / 10000, stoppedReason, counts, results, summary };
};

export type RunConfig = {
  apiKey: string | null;
  realtimeLinkedin: boolean;
  maxSpendUsd: number;
};

export const readConfig = (env: Record<string, string | undefined> = process.env): RunConfig => ({
  apiKey: readVariable(env.GENERECT_API_KEY),
  realtimeLinkedin: readBooleanVariable(env.REALTIME_LINKEDIN_LOOKUPS, false),
  maxSpendUsd: readSpendCap(env.MAX_SPEND_PER_RUN_USD, 5),
});

// Entry point of the command and the workflow step.
export const runEnrichment = async (
  kind: ObjectKind,
  recordIds: string[],
  mode: RunMode,
  options?: { runAs?: 'user' | 'application'; maxRecords?: number },
): Promise<RunResult> => {
  const config = readConfig();
  if (!config.apiKey) {
    throw new GenerectConfigError(
      'Generect API key is not set. A workspace admin sets it in Settings → Applications → Generect → Settings.',
    );
  }
  const result = await enrichRecords(kind, recordIds, {
    api: createTwentyApi({ runAs: options?.runAs ?? 'user' }),
    generect: createGenerectClient({ apiKey: config.apiKey, realtimeLinkedin: config.realtimeLinkedin }),
    maxSpendUsd: config.maxSpendUsd,
    maxRecords: options?.maxRecords ?? 50,
    mode,
    deadlineMs: 600_000,
  });
  if (config.apiKey.startsWith('test_')) result.summary = `${result.summary} (test key: sample data, nothing charged)`;
  return result;
};
