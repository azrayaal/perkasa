import type { BadgeStatus } from '@/types'

/**
 * Tone visual badge. Tambah tone baru di sini kalau design system bertambah |
 * bukan menulis kelas Tailwind ad-hoc di komponen.
 */
export type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'accent' | 'info'

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  // Pill amber solid dengan teks gelap | sorotan khas palet Perkasa.
  brand: 'bg-brand text-brand-ink',
  success: 'bg-state-success/12 text-state-success',
  warning: 'bg-state-warning/15 text-state-warning',
  error: 'bg-state-error/10 text-state-error',
  info: 'bg-state-info/10 text-state-info',
  neutral: 'bg-surface-alt text-ink-secondary',
  accent: 'bg-ink-strong text-page',
}

/**
 * Config-driven mapping status -> tone.
 * `Record<BadgeStatus, BadgeTone>` bersifat exhaustive: menambah status baru
 * di `types/index.ts` akan gagal compile sampai warnanya didefinisikan di sini.
 */
const STATUS_TONE: Record<BadgeStatus, BadgeTone> = {
  // Dokumen transaksi
  draft: 'neutral',
  posted: 'info',
  partial: 'warning',
  paid: 'success',
  overdue: 'error',
  // Persediaan
  'in-stock': 'success',
  'low-stock': 'warning',
  'out-of-stock': 'error',
  // Mitra & master data
  active: 'success',
  inactive: 'neutral',
  // Status SPT
  'kurang-bayar': 'warning',
  'lebih-bayar': 'info',
  nihil: 'neutral',
  // Shift kasir & metode bayar
  open: 'success',
  closed: 'neutral',
  tunai: 'brand',
  qris: 'info',
  debit: 'accent',
  // Sumber jurnal
  opening: 'neutral',
  pos: 'brand',
  sales: 'brand',
  purchase: 'accent',
  expense: 'warning',
  payment: 'info',
  inventory: 'neutral',
  manual: 'neutral',
  // Uji keseimbangan pembukuan
  balanced: 'success',
  unbalanced: 'error',
}

/** Label yang ditampilkan ke user (bahasa Indonesia, Title Case). */
const STATUS_LABEL: Record<BadgeStatus, string> = {
  draft: 'Draft',
  posted: 'Terposting',
  partial: 'Dibayar Sebagian',
  paid: 'Lunas',
  overdue: 'Jatuh Tempo',
  'in-stock': 'Stok Aman',
  'low-stock': 'Stok Menipis',
  'out-of-stock': 'Stok Habis',
  active: 'Aktif',
  inactive: 'Non-aktif',
  'kurang-bayar': 'Kurang Bayar',
  'lebih-bayar': 'Lebih Bayar',
  nihil: 'Nihil',
  open: 'Shift Buka',
  closed: 'Shift Ditutup',
  tunai: 'Tunai',
  qris: 'QRIS',
  debit: 'Kartu Debit',
  opening: 'Saldo Awal',
  pos: 'Kasir',
  sales: 'Penjualan',
  purchase: 'Pembelian',
  expense: 'Beban',
  payment: 'Kas & Bank',
  inventory: 'Gudang',
  manual: 'Jurnal Manual',
  balanced: 'Seimbang',
  unbalanced: 'Tidak Seimbang',
}

export function statusBadgeTone(status: BadgeStatus): BadgeTone {
  return STATUS_TONE[status] ?? 'neutral'
}

export function statusBadgeClass(status: BadgeStatus): string {
  return BADGE_TONE_CLASS[statusBadgeTone(status)]
}

export function statusLabel(status: BadgeStatus): string {
  return STATUS_LABEL[status] ?? status
}
