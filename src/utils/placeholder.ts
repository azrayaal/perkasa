/**
 * Penanda "tidak ada nilai" untuk sel tabel dan baris ringkasan.
 *
 * Ditulis sebagai escape Unicode, bukan karakter em dash langsung, supaya tidak
 * ikut tersapu oleh alat yang mengganti karakter non-ASCII di berkas sumber |
 * sel kosong yang berubah jadi tanda baca lain langsung terbaca sebagai cacat
 * tampilan di seluruh laporan.
 */
export const EMPTY = '\u2014'
