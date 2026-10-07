// Minimal GraphQL client for the workspace API. We build queries from the schema read at
// runtime, so the generated (install-time) CoreApiClient is not used: its typed selections
// would fail on a workspace that lacks one of the fields we try to read.

import {
  buildSelection,
  ENUM_QUERY,
  enumTypeNames,
  parseEnums,
  parseSchema,
  SCHEMA_QUERY,
  type ObjectSchema,
} from 'src/logic-functions/core/schema';
import { type TwentyRecord } from 'src/logic-functions/core/mapping';

export type ObjectKind = 'person' | 'company';

export type TwentyApi = {
  getSchema(kind: ObjectKind): Promise<ObjectSchema>;
  readRecords(kind: ObjectKind, ids: string[], fields: string[]): Promise<TwentyRecord[]>;
  updateRecord(kind: ObjectKind, id: string, data: Record<string, unknown>): Promise<void>;
};

const TYPE_NAME: Record<ObjectKind, { type: string; plural: string; update: string }> = {
  person: { type: 'Person', plural: 'people', update: 'updatePerson' },
  company: { type: 'Company', plural: 'companies', update: 'updateCompany' },
};

export class TwentyApiError extends Error {}

export const createTwentyApi = (options?: {
  baseUrl?: string;
  token?: string;
  runAs?: 'user' | 'application';
  fetchImpl?: typeof fetch;
}): TwentyApi => {
  const baseUrl = (options?.baseUrl ?? process.env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
  const token =
    options?.token ??
    (options?.runAs === 'application'
      ? process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN
      : process.env.TWENTY_APP_ACCESS_TOKEN) ??
    process.env.TWENTY_API_KEY;
  const fetchImpl = options?.fetchImpl ?? fetch;
  if (!baseUrl || !token) throw new TwentyApiError('TWENTY_API_URL / access token missing in the function environment');

  const gql = async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
    const response = await fetchImpl(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const text = await response.text();
    let body: { data?: T; errors?: { message: string }[] } | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      throw new TwentyApiError(`Twenty API HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    if (body?.errors?.length) throw new TwentyApiError(body.errors.map((e) => e.message).join('; ').slice(0, 500));
    if (!response.ok || !body?.data) throw new TwentyApiError(`Twenty API HTTP ${response.status}`);
    return body.data;
  };

  const schemaCache: Partial<Record<ObjectKind, ObjectSchema>> = {};

  return {
    async getSchema(kind) {
      const cached = schemaCache[kind];
      if (cached) return cached;
      let schema = parseSchema(await gql(SCHEMA_QUERY(TYPE_NAME[kind].type)));
      const enums = enumTypeNames(schema).filter((n) => /EmployeeRange|GenerectStatus/i.test(n));
      if (enums.length) schema = parseEnums(schema, await gql(ENUM_QUERY(enums)));
      schemaCache[kind] = schema;
      return schema;
    },
    async readRecords(kind, ids, fields) {
      if (ids.length === 0) return [];
      const schema = await this.getSchema(kind);
      const selection = buildSelection(schema, ['id', ...fields]);
      const { plural } = TYPE_NAME[kind];
      const data = await gql<Record<string, { edges: { node: TwentyRecord }[] }>>(
        `query GenerectRead($ids: [UUID!]!, $first: Int!) { ${plural}(filter: { id: { in: $ids } }, first: $first) { edges { node { ${selection} } } } }`,
        { ids, first: ids.length },
      );
      return (data[plural]?.edges ?? []).map((e) => e.node);
    },
    async updateRecord(kind, id, data) {
      const { type, update } = TYPE_NAME[kind];
      await gql(`mutation GenerectUpdate($id: UUID!, $data: ${type}UpdateInput!) { ${update}(id: $id, data: $data) { id } }`, {
        id,
        data,
      });
    },
  };
};
