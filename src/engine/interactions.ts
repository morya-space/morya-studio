import type { InteractBinding } from '../types/schema'

export interface InteractionPayload {
  card: { id: string; type: string }
  data: Record<string, unknown>
  event: { type: string }
}

const PATH_SEGMENT = /^[A-Za-z_$][\w$]*$/
const PARAM_NAME = /^[A-Za-z_$][\w$-]*$/
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

export function isSafeBinding(binding: InteractBinding): boolean {
  return PARAM_NAME.test(binding.target) && isSafePath(binding.source)
}

export function isSafePath(path: string): boolean {
  return path.split('.').length > 0 && path.split('.').every(segment => PATH_SEGMENT.test(segment) && !FORBIDDEN_SEGMENTS.has(segment))
}

/** Reads only own enumerable values from the constrained event snapshot. */
export function readPayloadPath(payload: InteractionPayload, path: string): unknown {
  if (!isSafePath(path)) return undefined

  let current: unknown = payload
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export function resolveInteractionParams(bindings: InteractBinding[], payload: InteractionPayload): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  for (const binding of bindings) {
    if (!isSafeBinding(binding)) continue
    const value = readPayloadPath(payload, binding.source)
    if (value !== undefined) params[binding.target] = value
  }
  return params
}
