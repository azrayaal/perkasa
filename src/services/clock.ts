/**
 * Jam aplikasi.
 *
 * Demo ini berjalan pada tanggal tetap supaya seluruh angka (umur piutang,
 * faktur jatuh tempo, tren bulanan) sama untuk siapa pun yang membukanya.
 *
 * TODO: ganti isinya dengan `new Date().toISOString().slice(0, 10)` saat
 * aplikasi memakai data produksi | tidak ada pemanggil yang perlu berubah.
 */
import { TODAY } from '@/data/mockData'
import type { IsoDate } from '@/types'

export function today(): IsoDate {
  return TODAY
}
