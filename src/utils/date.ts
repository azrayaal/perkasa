/**
 * Aritmetika tanggal berbasis string ISO ("YYYY-MM-DD").
 *
 * Sengaja tidak memakai objek `Date` sebagai tipe data aplikasi: seluruh
 * entitas menyimpan ISO string, jadi perbandingan cukup `<`/`>` leksikografis
 * dan tidak ada jebakan timezone saat data bolak-balik ke JSON.
 */
import type { IsoDate, PeriodKey } from '@/types'

const MS_PER_DAY = 86_400_000

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

const MONTH_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

/** UTC dipakai konsisten supaya hasil tidak bergeser di zona waktu mana pun. */
function toUtc(iso: IsoDate): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1)
}

function fromUtc(stamp: number): IsoDate {
  return new Date(stamp).toISOString().slice(0, 10)
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(iso) + days * MS_PER_DAY)
}

/** Selisih hari `to - from`; negatif kalau `to` lebih awal. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY)
}

/** 0 = Minggu … 6 = Sabtu. */
export function weekday(iso: IsoDate): number {
  return new Date(toUtc(iso)).getUTCDay()
}

export function isWeekend(iso: IsoDate): boolean {
  const day = weekday(iso)
  return day === 0 || day === 6
}

export function isoDate(year: number, month: number, day: number): IsoDate {
  return fromUtc(Date.UTC(year, month - 1, day))
}

/** "2026-07-22" -> "2026-07" */
export function periodOf(iso: IsoDate): PeriodKey {
  return iso.slice(0, 7)
}

export function startOfMonth(period: PeriodKey): IsoDate {
  return `${period}-01`
}

export function endOfMonth(period: PeriodKey): IsoDate {
  const [year, month] = period.split('-').map(Number)
  return fromUtc(Date.UTC(year, month, 0))
}

export function startOfYear(year: number): IsoDate {
  return `${year}-01-01`
}

export function endOfYear(year: number): IsoDate {
  return `${year}-12-31`
}

/** Periode bulan sebelumnya: "2026-01" -> "2025-12". */
export function previousPeriod(period: PeriodKey): PeriodKey {
  const [year, month] = period.split('-').map(Number)
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`
}

export function nextPeriod(period: PeriodKey): PeriodKey {
  const [year, month] = period.split('-').map(Number)
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`
}

/** "2026-07" -> "Jul 2026" */
export function periodLabel(period: PeriodKey): string {
  const [year, month] = period.split('-').map(Number)
  return `${MONTH_SHORT[month - 1]} ${year}`
}

/** "2026-07" -> "Juli 2026" */
export function periodLabelLong(period: PeriodKey): string {
  const [year, month] = period.split('-').map(Number)
  return `${MONTH_LONG[month - 1]} ${year}`
}

/** Daftar periode dari `from` sampai `to` (inklusif). */
export function periodRange(from: PeriodKey, to: PeriodKey): PeriodKey[] {
  const result: PeriodKey[] = []
  let cursor = from
  // Batas 240 iterasi = 20 tahun; pengaman agar rentang salah tidak menggantung.
  for (let guard = 0; guard < 240 && cursor <= to; guard += 1) {
    result.push(cursor)
    cursor = nextPeriod(cursor)
  }
  return result
}

/** Seluruh tanggal dari `from` sampai `to` (inklusif). */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const result: IsoDate[] = []
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) result.push(cursor)
  return result
}

/** `true` kalau `iso` berada di dalam rentang inklusif. */
export function isWithin(iso: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return iso >= from && iso <= to
}
