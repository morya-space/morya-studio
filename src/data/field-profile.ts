/**
 * Stable, UI-independent field inference for datasource rows.
 * Consumers can use the profiles to populate component field pickers.
 */

export type Row = Record<string, unknown>

export type FieldValueKind = 'number' | 'date' | 'boolean' | 'string' | 'unknown'

export type FieldSemanticHint =
  | 'identifier'
  | 'name'
  | 'title'
  | 'category'
  | 'status'
  | 'currency'
  | 'percent'
  | 'email'
  | 'url'
  | 'date'
  | 'unknown'

export type FieldSampleValue = string | number | boolean

export interface FieldProfile {
  key: string
  label: string
  valueKind: FieldValueKind
  semanticHint: FieldSemanticHint
  nullable: boolean
  sampleValues: FieldSampleValue[]
}

/** Field binding needs shared by existing chart, stat, table, and list cards. */
export type FieldRole =
  | 'chart-dimension'
  | 'chart-value'
  | 'chart-series'
  | 'stat-value'
  | 'stat-label'
  | 'list-title'
  | 'list-subtitle'
  | 'list-value'
  | 'trend'
  | 'table-column'

const SAMPLE_LIMIT = 3

export function inferFieldProfiles(rows: readonly Row[]): FieldProfile[] {
  const fields = new Map<string, FieldAccumulator>()

  for (const row of rows) {
    for (const field of fields.values()) field.presentInRow = false

    for (const [key, value] of Object.entries(row)) {
      let field = fields.get(key)
      if (!field) {
        field = createAccumulator(key)
        fields.set(key, field)
      }
      field.presentInRow = true
      observeValue(field, value)
    }

    for (const field of fields.values()) {
      if (!field.presentInRow) field.nullable = true
    }
  }

  return [...fields.values()].map(field => ({
    key: field.key,
    label: humanizeFieldKey(field.key),
    valueKind: resolveValueKind(field.observedKinds),
    semanticHint: inferSemanticHint(field.key, resolveValueKind(field.observedKinds)),
    nullable: field.nullable,
    sampleValues: field.sampleValues,
  }))
}

export function filterFieldsForRole(
  profiles: readonly FieldProfile[],
  role: FieldRole,
): FieldProfile[] {
  return profiles.filter(profile => isFieldCompatibleWithRole(profile, role))
}

export function isFieldCompatibleWithRole(profile: FieldProfile, role: FieldRole): boolean {
  switch (role) {
    case 'chart-value':
    case 'stat-value':
    case 'list-value':
    case 'trend':
      return profile.valueKind === 'number'
    case 'chart-dimension':
      return profile.valueKind === 'string' || profile.valueKind === 'date' || profile.valueKind === 'boolean'
    case 'chart-series':
      return profile.valueKind === 'string' || profile.valueKind === 'boolean'
    case 'stat-label':
    case 'list-title':
      return profile.valueKind === 'string'
    case 'list-subtitle':
      return profile.valueKind === 'string' || profile.valueKind === 'date' || profile.valueKind === 'boolean'
    case 'table-column':
      return true
  }
}

interface FieldAccumulator {
  key: string
  nullable: boolean
  presentInRow: boolean
  observedKinds: Set<FieldValueKind>
  sampleValues: FieldSampleValue[]
}

function createAccumulator(key: string): FieldAccumulator {
  return {
    key,
    nullable: false,
    presentInRow: false,
    observedKinds: new Set<FieldValueKind>(),
    sampleValues: [],
  }
}

function observeValue(field: FieldAccumulator, value: unknown): void {
  if (value === null || value === undefined) {
    field.nullable = true
    return
  }

  field.observedKinds.add(valueKindOf(value))
  if (isSampleValue(value) && field.sampleValues.length < SAMPLE_LIMIT && !field.sampleValues.includes(value)) {
    field.sampleValues.push(value)
  }
}

function valueKindOf(value: unknown): FieldValueKind {
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'unknown'
  if (typeof value === 'boolean') return 'boolean'
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'unknown' : 'date'
  if (typeof value === 'string') return isDateString(value) ? 'date' : 'string'
  return 'unknown'
}

function resolveValueKind(kinds: ReadonlySet<FieldValueKind>): FieldValueKind {
  if (kinds.size !== 1) return 'unknown'
  return kinds.values().next().value ?? 'unknown'
}

function isSampleValue(value: unknown): value is FieldSampleValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && !Number.isNaN(Date.parse(value))
}

function humanizeFieldKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return key
  return words.map(word => word.toLowerCase() === 'id' ? 'ID' : capitalize(word)).join(' ')
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function inferSemanticHint(key: string, kind: FieldValueKind): FieldSemanticHint {
  const normalized = key.toLowerCase()
  if (kind === 'date') return 'date'
  if (/(^|[_-])(id|uuid|guid|code)($|[_-])/.test(normalized) || normalized.endsWith('id')) return 'identifier'
  if (/(email|e_mail)/.test(normalized)) return 'email'
  if (/(url|uri|link|website|href)/.test(normalized)) return 'url'
  if (/(amount|price|cost|revenue|sales|income|balance|fee)/.test(normalized)) return 'currency'
  if (/(percent|percentage|ratio|rate|pct)/.test(normalized)) return 'percent'
  if (/(status|state|level|priority)/.test(normalized)) return 'status'
  if (/(category|type|group|class|kind)/.test(normalized)) return 'category'
  if (/(title|subject|headline)/.test(normalized)) return 'title'
  if (/(name|label|display)/.test(normalized)) return 'name'
  return 'unknown'
}
