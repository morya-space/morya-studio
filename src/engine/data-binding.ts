/**
 * Pure data-binding validation for card registrations.
 * It intentionally accepts transformed rows so callers can validate the data
 * a card will actually receive without coupling this module to Vue or stores.
 */

import { inferFieldProfiles, type FieldProfile, type Row } from '../data/field-profile'
import type { CardSchema } from '../types/schema'
import type { DataFieldType, DataRole } from './data-role'
import type { CardRegistration } from './registry'

export type BindingIssueLevel = 'error' | 'warning' | 'info'

export type BindingIssueCode =
  | 'required-unbound'
  | 'field-missing'
  | 'incompatible'
  | 'no-data'

export interface BindingIssue {
  level: BindingIssueLevel
  code: BindingIssueCode
  role: string
  field?: string
  path?: string
  message: string
}

export interface DataBindingResult {
  profiles: FieldProfile[]
  issues: BindingIssue[]
}

/** Optional explicit bindings for roles without a fixed CardSchema field path. */
export type DataRoleBindings = Readonly<Record<string, string | readonly string[] | undefined>>

/**
 * Returns profiles accepted by a registration role. This is the picker-facing
 * API: use it to constrain `auto:dataFields` options to the selected role.
 */
export function filterFieldsForDataRole(
  profiles: readonly FieldProfile[],
  role: Pick<DataRole, 'acceptedTypes'>,
): FieldProfile[] {
  return profiles.filter(profile => role.acceptedTypes.includes(profile.valueKind))
}

/**
 * Checks configured role bindings against transformed rows.
 *
 * Missing required bindings are errors. Once rows are available, a configured
 * missing field is an error and an incompatible inferred type is a warning.
 * Empty or unavailable rows remain unverifiable information, never errors.
 */
export function validateDataBindings(
  card: CardSchema,
  registration: Pick<CardRegistration, 'dataContract'> | undefined,
  rows: readonly Row[] | undefined,
  bindings: DataRoleBindings = {},
): DataBindingResult {
  const profiles = inferFieldProfiles(rows ?? [])
  const issues: BindingIssue[] = []
  const roles = registration?.dataContract?.roles

  if (!roles?.length) return { profiles, issues }

  for (const role of roles) {
    const fields = resolveRoleFields(card, role, bindings)
    if (fields.length === 0) {
      if (role.required) {
        issues.push({
          level: 'error',
          code: 'required-unbound',
          role: role.name,
          path: role.field,
          message: `Required ${role.label} role is not bound`,
        })
      }
      continue
    }

    if (!rows?.length) {
      for (const field of fields) {
        issues.push({
          level: 'info',
          code: 'no-data',
          role: role.name,
          field,
          path: role.field,
          message: `${role.label} binding "${field}" could not be verified because no data is available`,
        })
      }
      continue
    }

    for (const field of fields) {
      const profile = profiles.find(candidate => candidate.key === field)
      if (!profile) {
        issues.push({
          level: 'error',
          code: 'field-missing',
          role: role.name,
          field,
          path: role.field,
          message: `${role.label} binding "${field}" is not present in the data`,
        })
      } else if (!role.acceptedTypes.includes(profile.valueKind)) {
        issues.push({
          level: 'warning',
          code: 'incompatible',
          role: role.name,
          field,
          path: role.field,
          message: `${role.label} binding "${field}" has type "${profile.valueKind}"; expected ${formatTypes(role.acceptedTypes)}`,
        })
      }
    }
  }

  return { profiles, issues }
}

function resolveRoleFields(card: CardSchema, role: DataRole, bindings: DataRoleBindings): string[] {
  const configured = bindings[role.name] ?? (role.field ? getStringAtPath(card, role.field) : undefined)
  if (Array.isArray(configured)) {
    return configured.filter((field): field is string => typeof field === 'string' && field.length > 0)
  }
  if (typeof configured !== 'string' || configured.length === 0) return []
  return [configured]
}

function getStringAtPath(source: unknown, path: string): string | undefined {
  let value = source
  for (const key of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return typeof value === 'string' ? value : undefined
}

function formatTypes(types: readonly DataFieldType[]): string {
  return types.map(type => `"${type}"`).join(', ')
}
