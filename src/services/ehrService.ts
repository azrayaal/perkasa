import { commit, db, nextId } from '@/data/db'
import { respond } from '@/services/http'
import type { Ehr, HealthSummary, NewEhrPayload, ResidentId } from '@/types'

/**
 * Ambang klinis untuk menurunkan status "perlu perhatian".
 * Config-driven: nanti nilai ini datang dari care policy backend, bukan hardcode di UI.
 */
const VITALS_THRESHOLD = {
  systolicMax: 140,
  diastolicMax: 90,
  heartRateMin: 60,
  heartRateMax: 100,
} as const

/** TODO: replace with real API call — GET /ehr */
export function getAllEhr(): Promise<Ehr[]> {
  return respond(db().ehr)
}

/** TODO: replace with real API call — GET /ehr?residentId= */
export function getEhrByResident(id: ResidentId): Promise<Ehr[]> {
  return respond(db().ehr.filter((record) => record.residentId === id))
}

function parseBloodPressure(value: string): { systolic: number; diastolic: number } | null {
  const [systolic, diastolic] = value.split('/').map((part) => Number.parseInt(part.trim(), 10))
  if (Number.isNaN(systolic) || Number.isNaN(diastolic)) return null
  return { systolic, diastolic }
}

function isWithinNormalRange(record: Ehr): boolean {
  const bp = parseBloodPressure(record.bloodPressure)
  if (bp && (bp.systolic > VITALS_THRESHOLD.systolicMax || bp.diastolic > VITALS_THRESHOLD.diastolicMax)) {
    return false
  }

  return (
    record.heartRate >= VITALS_THRESHOLD.heartRateMin && record.heartRate <= VITALS_THRESHOLD.heartRateMax
  )
}

/**
 * Turunkan ringkasan kesehatan non-sensitif dari catatan EHR.
 * Hasilnya sengaja hanya level + tanggal + caregiver — dipakai Family Portal
 * sehingga detail medis tidak pernah keluar dari service layer.
 */
export function summarizeHealth(records: Ehr[]): HealthSummary {
  const latest = [...records].sort((a, b) => b.date.localeCompare(a.date)).at(0) ?? null

  if (!latest) {
    return { level: 'needs-attention', lastCheckDate: null, caregiver: null }
  }

  return {
    level: isWithinNormalRange(latest) ? 'stable' : 'needs-attention',
    lastCheckDate: latest.date,
    caregiver: latest.caregiver,
  }
}

/** TODO: replace with real API call — GET /ehr/summary?residentId= */
export async function getHealthSummaryByResident(id: ResidentId): Promise<HealthSummary> {
  return summarizeHealth(await getEhrByResident(id))
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call — POST /ehr */
export function createEhrRecord(payload: NewEhrPayload): Promise<Ehr> {
  const created = commit((database) => {
    const record: Ehr = { ...payload, id: nextId('EHR', database.ehr.length) }
    database.ehr.push(record)
    return record
  })

  return respond(created)
}
