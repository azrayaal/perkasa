import { db } from '@/data/db'
import { summarizeHealth } from '@/services/ehrService'
import { respond } from '@/services/http'
import type { DashboardStats, TimelineEntry } from '@/types'

/**
 * Seluruh agregasi dashboard dihitung di sini — view hanya me-render angka.
 *
 * TODO: replace with real API call — GET /dashboard/stats
 */
export function getDashboardStats(): Promise<DashboardStats> {
  const database = db()

  const unpaid = database.billing.filter((invoice) => invoice.status !== 'paid')

  const residentsNeedingAttention = database.residents.filter((resident) => {
    const records = database.ehr.filter((row) => row.residentId === resident.id)
    return summarizeHealth(records).level === 'needs-attention'
  }).length

  return respond({
    totalResidents: database.residents.length,
    activeResidents: database.residents.filter((resident) => resident.status === 'active').length,
    occupiedUnits: database.units.filter((unit) => unit.status === 'occupied').length,
    totalUnits: database.units.length,
    outstandingAmount: unpaid.reduce((sum, invoice) => sum + invoice.total, 0),
    unpaidInvoiceCount: unpaid.length,
    activitiesThisPeriod: database.activities.length,
    residentsNeedingAttention,
  })
}

/**
 * Feed lintas-modul: billing, EHR, dan aktivitas digabung jadi satu linimasa.
 * Inilah bukti nyata data tersatukan — satu aliran, bukan lima sistem terpisah.
 *
 * TODO: replace with real API call — GET /dashboard/timeline
 */
export function getRecentTimeline(limit = 8): Promise<TimelineEntry[]> {
  const database = db()
  const nameById = new Map(database.residents.map((resident) => [resident.id, resident.name]))

  const entries: TimelineEntry[] = [
    ...database.billing.map((invoice) => ({
      id: `t-${invoice.id}`,
      residentId: invoice.residentId,
      residentName: nameById.get(invoice.residentId) ?? 'Penghuni',
      source: 'billing' as const,
      description: `Invoice ${invoice.id} periode ${invoice.period}`,
      date: invoice.period,
    })),
    ...database.ehr.map((record) => ({
      id: `t-${record.id}`,
      residentId: record.residentId,
      residentName: nameById.get(record.residentId) ?? 'Penghuni',
      source: 'ehr' as const,
      description: `Pemeriksaan oleh ${record.caregiver}`,
      date: record.date,
    })),
    ...database.activities.map((activity) => ({
      id: `t-${activity.id}`,
      residentId: activity.residentId,
      residentName: nameById.get(activity.residentId) ?? 'Penghuni',
      source: 'activity' as const,
      description: activity.activity,
      date: activity.date,
    })),
  ]

  return respond(
    entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit),
  )
}
