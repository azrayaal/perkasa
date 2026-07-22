import { commit, db, nextId } from '@/data/db'
import { getActivitiesByResident } from '@/services/activityService'
import { getBillingByResident, summarizeBilling } from '@/services/billingService'
import { getEhrByResident, summarizeHealth } from '@/services/ehrService'
import { getFamilyMembersByResident } from '@/services/familyService'
import { NotFoundError, respond } from '@/services/http'
import { getUnitById, getUnits } from '@/services/unitService'
import type {
  NewResidentPayload,
  Resident,
  ResidentDataOptions,
  ResidentFullData,
  ResidentId,
  ResidentListItem,
  ResidentStatus,
} from '@/types'

/** TODO: replace with real API call — GET /residents */
export function getResidents(): Promise<Resident[]> {
  return respond(db().residents)
}

/** TODO: replace with real API call — GET /residents/:id */
export function getResidentById(id: ResidentId): Promise<Resident | null> {
  return respond(db().residents.find((resident) => resident.id === id) ?? null)
}

/**
 * Daftar resident yang sudah di-join dengan unitnya.
 * Join dilakukan di sini supaya view cukup me-render, tidak menghitung apa pun.
 *
 * TODO: replace with real API call — GET /residents?expand=unit
 */
export async function getResidentList(): Promise<ResidentListItem[]> {
  const [residentRows, unitRows] = await Promise.all([getResidents(), getUnits()])
  const unitById = new Map(unitRows.map((unit) => [unit.id, unit]))

  return residentRows.map((resident) => ({
    resident,
    unit: unitById.get(resident.unitId) ?? null,
  }))
}

/**
 * Agregat 360° satu resident — inti dari POC ini: data yang tadinya tersebar di
 * modul property, billing, kesehatan, aktivitas, dan family portal disatukan
 * dalam satu kontrak.
 *
 * `isFamilyView: true` memangkas data medis detail DI SERVICE LAYER, bukan di
 * komponen — supaya data sensitif tidak pernah sampai ke client family portal.
 *
 * TODO: replace with real API call — GET /residents/:id/overview?scope=
 */
export async function getResidentDetail(
  id: ResidentId,
  options: ResidentDataOptions = {},
): Promise<ResidentFullData> {
  const resident = await getResidentById(id)
  if (!resident) throw new NotFoundError('Resident', id)

  const [unit, billing, ehr, activities, familyMembers] = await Promise.all([
    getUnitById(resident.unitId),
    getBillingByResident(id),
    getEhrByResident(id),
    getActivitiesByResident(id),
    getFamilyMembersByResident(id),
  ])

  const isFamilyView = options.isFamilyView ?? false

  return {
    resident,
    unit,
    billing,
    billingSummary: summarizeBilling(billing),
    ehr: isFamilyView ? null : ehr,
    healthSummary: summarizeHealth(ehr),
    activities,
    familyMembers,
  }
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call — POST /residents */
export function createResident(payload: NewResidentPayload): Promise<Resident> {
  const created = commit((database) => {
    const resident: Resident = { ...payload, id: nextId('R', database.residents.length) }
    database.residents.push(resident)

    // Menempatkan penghuni otomatis mengubah okupansi unit — aturan bisnis ini
    // milik service layer, bukan komponen.
    const unit = database.units.find((row) => row.id === resident.unitId)
    if (unit) unit.status = 'occupied'

    return resident
  })

  return respond(created)
}

/** TODO: replace with real API call — PATCH /residents/:id */
export function updateResidentStatus(id: ResidentId, status: ResidentStatus): Promise<Resident> {
  const updated = commit((database) => {
    const resident = database.residents.find((row) => row.id === id)
    if (!resident) return null
    resident.status = status

    if (status === 'inactive') {
      const unit = database.units.find((row) => row.id === resident.unitId)
      if (unit) unit.status = 'vacant'
    }

    return resident
  })

  if (!updated) throw new NotFoundError('Resident', id)
  return respond(updated)
}
