/**
 * Aturan status & umur dokumen — dipakai bersama modul penjualan dan pembelian.
 *
 * `overdue` sengaja TIDAK disimpan di database: ia selalu dihitung dari tanggal
 * jatuh tempo terhadap tanggal hari ini, supaya tidak ada faktur yang statusnya
 * basi karena lupa dijalankan tugas terjadwal.
 */
import { daysBetween } from '@/utils/date'
import type { Aging, AgingBucket, DocumentStatus, IsoDate, StoredDocumentStatus } from '@/types'

export function resolveStatus(
  stored: StoredDocumentStatus,
  dueDate: IsoDate,
  todayIso: IsoDate,
): DocumentStatus {
  if (stored === 'paid' || stored === 'draft') return stored
  return dueDate < todayIso ? 'overdue' : stored
}

/** Hari lewat jatuh tempo; 0 kalau belum jatuh tempo atau sudah lunas. */
export function overdueDays(
  status: DocumentStatus,
  dueDate: IsoDate,
  todayIso: IsoDate,
): number {
  if (status !== 'overdue') return 0
  return Math.max(0, daysBetween(dueDate, todayIso))
}

interface AgingInput {
  dueDate: IsoDate
  outstanding: number
}

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: 'Belum jatuh tempo', max: 0 },
  { label: '1–30 hari', max: 30 },
  { label: '31–60 hari', max: 60 },
  { label: '61–90 hari', max: 90 },
  { label: '> 90 hari', max: Number.POSITIVE_INFINITY },
]

/** Umur piutang/utang dalam lima kelompok standar. */
export function buildAging(items: AgingInput[], todayIso: IsoDate): Aging {
  const buckets: AgingBucket[] = BUCKETS.map((bucket) => ({ label: bucket.label, amount: 0, count: 0 }))

  for (const item of items) {
    if (item.outstanding <= 0) continue

    const age = daysBetween(item.dueDate, todayIso)
    const index = age <= 0 ? 0 : BUCKETS.findIndex((bucket) => age <= bucket.max)
    const target = buckets[index === -1 ? buckets.length - 1 : index]

    target.amount += item.outstanding
    target.count += 1
  }

  return { buckets, total: buckets.reduce((sum, bucket) => sum + bucket.amount, 0) }
}
