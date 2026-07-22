import { commit, db } from '@/data/db'
import { NotFoundError, respond } from '@/services/http'
import type { Unit, UnitId, UnitStatus } from '@/types'

/** TODO: replace with real API call — GET /units */
export function getUnits(): Promise<Unit[]> {
  return respond(db().units)
}

/** TODO: replace with real API call — GET /units/:id */
export function getUnitById(id: UnitId): Promise<Unit | null> {
  return respond(db().units.find((unit) => unit.id === id) ?? null)
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call — PATCH /units/:id */
export function updateUnitStatus(unitId: UnitId, status: UnitStatus): Promise<Unit> {
  const updated = commit((database) => {
    const unit = database.units.find((row) => row.id === unitId)
    if (!unit) return null
    unit.status = status
    return unit
  })

  if (!updated) throw new NotFoundError('Unit', unitId)
  return respond(updated)
}
