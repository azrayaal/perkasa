import { db } from '@/data/db'
import { respond } from '@/services/http'
import type {
  Activity,
  Billing,
  Ehr,
  FamilyMember,
  ResidentId,
  UnitRow,
  WithResident,
} from '@/types'

/**
 * Baris tabel lintas-resident untuk halaman modul (Billing, Kesehatan, dst).
 *
 * Modul ini terpisah dari service per-entity supaya tidak terjadi import
 * melingkar: `residentService` sudah memanggil `billingService`, jadi join balik
 * ke nama penghuni ditaruh di sini.
 *
 * TODO: replace with real API call — endpoint list per modul dengan `expand=resident`.
 */
function residentNameMap(): Map<ResidentId, string> {
  return new Map(db().residents.map((resident) => [resident.id, resident.name]))
}

const UNKNOWN_RESIDENT = 'Penghuni tidak dikenal'

export function getBillingRows(): Promise<WithResident<Billing>[]> {
  const names = residentNameMap()
  return respond(
    db().billing.map((invoice) => ({
      ...invoice,
      residentName: names.get(invoice.residentId) ?? UNKNOWN_RESIDENT,
    })),
  )
}

export function getEhrRows(): Promise<WithResident<Ehr>[]> {
  const names = residentNameMap()
  return respond(
    db()
      .ehr.map((record) => ({
        ...record,
        residentName: names.get(record.residentId) ?? UNKNOWN_RESIDENT,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  )
}

export function getActivityRows(): Promise<WithResident<Activity>[]> {
  const names = residentNameMap()
  return respond(
    db()
      .activities.map((activity) => ({
        ...activity,
        residentName: names.get(activity.residentId) ?? UNKNOWN_RESIDENT,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  )
}

export function getFamilyRows(): Promise<WithResident<FamilyMember>[]> {
  const names = residentNameMap()
  return respond(
    db().familyMembers.map((member) => ({
      ...member,
      residentName: names.get(member.residentId) ?? UNKNOWN_RESIDENT,
    })),
  )
}

export function getUnitRows(): Promise<UnitRow[]> {
  const database = db()

  return respond(
    database.units.map((unit) => {
      const occupant = database.residents.find(
        (resident) => resident.unitId === unit.id && resident.status === 'active',
      )

      return {
        unit,
        occupantName: occupant?.name ?? null,
        occupantId: occupant?.id ?? null,
      }
    }),
  )
}
