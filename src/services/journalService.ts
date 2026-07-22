/**
 * Modul Pembukuan — jurnal umum & buku besar.
 *
 * Halaman ini adalah "kotak hitam" perusahaan: setiap dokumen di modul mana pun
 * pasti muncul di sini sebagai jurnal berpasangan. Akuntan tetap bisa menulis
 * jurnal manual (penyusutan, koreksi, reklasifikasi), dan jurnal manual itu
 * wajib seimbang sebelum diterima.
 */
import { commit, db } from '@/data/db'
import { respond, ValidationError } from '@/services/http'
import { buildJournal } from '@/services/postingService'
import type { IsoDate, JournalEntry, JournalSource, ManualJournal, NewManualJournalPayload } from '@/types'

export interface JournalQuery {
  from: IsoDate
  to: IsoDate
  /** `null` = semua modul. */
  source?: JournalSource | null
  /** Cari pada nomor jurnal, nomor dokumen, keterangan, atau kode akun. */
  search?: string
}

export interface JournalSummary {
  entryCount: number
  totalDebit: number
  totalCredit: number
  /** Selisih debit-kredit; nol berarti pembukuan seimbang. */
  difference: number
}

export const SOURCE_LABEL: Record<JournalSource, string> = {
  opening: 'Saldo Awal',
  sales: 'Penjualan',
  purchase: 'Pembelian',
  expense: 'Beban',
  payment: 'Kas & Bank',
  inventory: 'Gudang',
  manual: 'Jurnal Manual',
}

function matches(entry: JournalEntry, query: JournalQuery): boolean {
  if (entry.date < query.from || entry.date > query.to) return false
  if (query.source && entry.source !== query.source) return false

  const term = query.search?.trim().toLowerCase()
  if (!term) return true

  return (
    entry.number.toLowerCase().includes(term) ||
    entry.description.toLowerCase().includes(term) ||
    (entry.refNumber ?? '').toLowerCase().includes(term) ||
    entry.lines.some((line) => line.accountCode.includes(term) || line.memo.toLowerCase().includes(term))
  )
}

/** TODO: replace with real API call — GET /journal?from=&to=&source= */
export function getJournalEntries(query: JournalQuery): Promise<JournalEntry[]> {
  const entries = buildJournal()
    .filter((entry) => matches(entry, query))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))

  return respond(entries)
}

/** Ringkasan jurnal satu periode — dipakai kartu statistik halaman Pembukuan. */
export function getJournalSummary(from: IsoDate, to: IsoDate): Promise<JournalSummary> {
  const entries = buildJournal().filter((entry) => entry.date >= from && entry.date <= to)

  let totalDebit = 0
  let totalCredit = 0

  for (const entry of entries) {
    for (const line of entry.lines) {
      totalDebit += line.debit
      totalCredit += line.credit
    }
  }

  return respond({
    entryCount: entries.length,
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit,
  })
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Simpan jurnal manual. Jurnal yang tidak seimbang ditolak di sini, sehingga
 * neraca saldo aplikasi dijamin selalu balance.
 *
 * TODO: replace with real API call — POST /journal
 */
export function createManualJournal(payload: NewManualJournalPayload): Promise<ManualJournal> {
  const usable = payload.lines.filter((line) => line.debit > 0 || line.credit > 0)

  if (usable.length < 2) throw new ValidationError('Jurnal manual minimal terdiri dari dua baris.')

  const totalDebit = usable.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = usable.reduce((sum, line) => sum + line.credit, 0)

  if (totalDebit !== totalCredit) {
    throw new ValidationError(
      `Jurnal belum seimbang — selisih ${Math.abs(totalDebit - totalCredit).toLocaleString('id-ID')}.`,
    )
  }

  if (usable.some((line) => line.debit > 0 && line.credit > 0)) {
    throw new ValidationError('Satu baris hanya boleh diisi debit atau kredit, tidak keduanya.')
  }

  const created = commit((database) => {
    const sequence = database.manualJournals.length + 1
    const journal: ManualJournal = {
      id: `MJU-${String(sequence).padStart(4, '0')}`,
      number: `JU-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      date: payload.date,
      description: payload.description,
      lines: usable,
    }
    database.manualJournals.push(journal)
    return journal
  })

  return respond(created)
}

/** Daftar jurnal manual yang tersimpan (untuk halaman Pembukuan tab manual). */
export function getManualJournals(): Promise<ManualJournal[]> {
  return respond(
    [...db().manualJournals].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
  )
}
