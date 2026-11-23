import { z } from 'zod'

/** Constraint keywords that structured-output validators commonly reject; zod still enforces what it knows locally. */
const UNSUPPORTED = new Set([
  'maxItems',
  'minItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'maxLength',
  'minLength',
  'pattern',
  'multipleOf',
  'uniqueItems',
  'format',
  'minProperties',
  'maxProperties',
  '$schema'
])

export function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED.has(k)) continue
      out[k] = stripUnsupported(v)
    }
    return out
  }
  return node
}

/** JSON Schema sent to the CLI: no size or pattern constraints. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(schema)) as Record<string, unknown>
}
