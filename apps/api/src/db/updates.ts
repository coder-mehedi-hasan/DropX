/**
 * SET-assignment builder for partial UPDATEs.
 *
 * The patch keys are resolved through an explicit column map instead of being
 * interpolated as column names. That is not ceremony: a camelCase field like
 * `registrationNumber` has no same-named column, so interpolating the key emits
 * `UPDATE ... SET registrationNumber = ?`, which MySQL rejects only when that
 * particular field is present in the payload — a write path that works until a
 * user edits exactly that field, then 500s.
 *
 * The map is typed `Record<K, string>` over the patch's own keys, so it must
 * cover every field: adding a field to a model is a type error here until the
 * column is mapped. That is the point — the mapping cannot silently go stale.
 */

/** mysql2 binds each element itself and types its own parameter list as `any[]`. */
export type SqlParams = any[]

export function buildAssignments<K extends string>(
  patch: Partial<Record<K, unknown>>,
  columns: Record<K, string>,
): { assignments: string[]; params: SqlParams } {
  const assignments: string[] = []
  const params: SqlParams = []

  for (const key of Object.keys(patch) as K[]) {
    const value = patch[key]
    if (value === undefined) continue
    const column = columns[key]
    if (!column) throw new Error(`No column mapped for patch field "${key}"`)
    assignments.push(`${column} = ?`)
    params.push(value)
  }

  return { assignments, params }
}
