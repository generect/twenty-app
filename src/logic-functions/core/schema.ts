// The workspace schema, read at runtime. Every Twenty workspace differs (custom fields,
// deleted fields, renamed ones), so the app never assumes a field exists: it maps only
// into fields that are both readable and writable here and skips the rest.

export type ObjectSchema = {
  // field name -> GraphQL named type of the read side (String, Links, FullName, CompanyEmployeeRangeEnum, ...)
  readable: Record<string, string>;
  writable: Set<string>;
  // enum type name -> allowed values
  enums: Record<string, string[]>;
};

type IntrospectionTypeRef = { kind: string; name: string | null; ofType?: IntrospectionTypeRef | null };
type IntrospectionField = { name: string; type: IntrospectionTypeRef };

export const namedType = (ref: IntrospectionTypeRef | null | undefined): { kind: string; name: string } | null => {
  let cursor = ref;
  while (cursor && !cursor.name) cursor = cursor.ofType ?? null;
  return cursor?.name ? { kind: cursor.kind, name: cursor.name } : null;
};

export const SCHEMA_QUERY = (typeName: string) => `
  query GenerectSchema {
    read: __type(name: "${typeName}") { fields { name type { kind name ofType { kind name ofType { kind name } } } } }
    write: __type(name: "${typeName}UpdateInput") { inputFields { name type { kind name ofType { kind name } } } }
  }
`;

export const ENUM_QUERY = (names: string[]) =>
  `query GenerectEnums { ${names
    .map((name, i) => `e${i}: __type(name: "${name}") { name enumValues { name } }`)
    .join(' ')} }`;

export const parseSchema = (data: {
  read?: { fields?: IntrospectionField[] } | null;
  write?: { inputFields?: IntrospectionField[] } | null;
}): ObjectSchema => {
  const readable: Record<string, string> = {};
  const enumNames: string[] = [];
  for (const field of data.read?.fields ?? []) {
    const t = namedType(field.type);
    if (!t) continue;
    readable[field.name] = t.name;
    if (t.kind === 'ENUM') enumNames.push(t.name);
  }
  const writable = new Set((data.write?.inputFields ?? []).map((f) => f.name));
  return { readable, writable, enums: {} };
};

export const enumTypeNames = (schema: ObjectSchema): string[] =>
  Object.values(schema.readable).filter((t) => t.endsWith('Enum'));

export const parseEnums = (
  schema: ObjectSchema,
  data: Record<string, { name: string; enumValues?: { name: string }[] } | null>,
): ObjectSchema => {
  const enums: Record<string, string[]> = {};
  for (const value of Object.values(data)) {
    if (value?.name) enums[value.name] = (value.enumValues ?? []).map((v) => v.name);
  }
  return { ...schema, enums };
};

// True when `field` exists, is writable, and its read type is one of `types`.
export const hasField = (schema: ObjectSchema, field: string, ...types: string[]): boolean => {
  const t = schema.readable[field];
  if (!t || !schema.writable.has(field)) return false;
  return types.length === 0 || types.includes(t);
};

// GraphQL selection for the fields we read, built only from fields that exist.
const COMPOSITE_SELECTIONS: Record<string, string> = {
  FullName: '{ firstName lastName }',
  Links: '{ primaryLinkUrl }',
  Emails: '{ primaryEmail }',
  Address: '{ addressStreet1 addressCity addressState addressPostcode addressCountry }',
  Actor: '{ source }',
};

const SCALARS = new Set(['String', 'Float', 'Int', 'Boolean', 'Date', 'DateTime', 'UUID', 'ID']);

export const buildSelection = (schema: ObjectSchema, fields: string[]): string =>
  fields
    .filter((f) => schema.readable[f])
    .map((f) => {
      const t = schema.readable[f];
      if (COMPOSITE_SELECTIONS[t]) return `${f} ${COMPOSITE_SELECTIONS[t]}`;
      if (SCALARS.has(t) || t.endsWith('Enum')) return f;
      return null; // relations, JSON, files: never selected
    })
    .filter((s): s is string => s !== null)
    .join(' ');
