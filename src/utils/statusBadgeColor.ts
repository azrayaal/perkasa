import type { BadgeStatus } from '@/types'

/**
 * Tone visual badge. Tambah tone baru di sini kalau design system bertambah —
 * bukan menulis kelas Tailwind ad-hoc di komponen.
 */
export type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'accent'

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  // Pill lime solid dengan teks gelap — bentuk khas palet referensi.
  success: 'bg-brand text-brand-ink',
  warning: 'bg-state-warning/15 text-state-warning',
  error: 'bg-state-error/10 text-state-error',
  neutral: 'bg-surface-alt text-ink-secondary',
  brand: 'bg-ink-strong text-page',
  accent: 'bg-ink-strong/[0.07] text-ink-primary',
}

/**
 * Config-driven mapping status -> tone.
 * `Record<BadgeStatus, BadgeTone>` bersifat exhaustive: menambah status baru di
 * `types/index.ts` akan gagal compile sampai warnanya didefinisikan di sini.
 */
const STATUS_TONE: Record<BadgeStatus, BadgeTone> = {
  // Resident
  active: 'success',
  inactive: 'neutral',
  pending: 'warning',
  // Unit
  occupied: 'brand',
  vacant: 'neutral',
  booked: 'warning',
  maintenance: 'warning',
  // Billing
  paid: 'success',
  unpaid: 'warning',
  overdue: 'error',
  // Activity
  attended: 'success',
  cancelled: 'error',
  // Membership tier
  Premium: 'accent',
  Standard: 'neutral',
  // Ringkasan kesehatan (family view)
  stable: 'success',
  'needs-attention': 'warning',
}

/** Label yang ditampilkan ke user (bahasa Indonesia, Title Case). */
const STATUS_LABEL: Record<BadgeStatus, string> = {
  active: 'Aktif',
  inactive: 'Non-aktif',
  pending: 'Menunggu',
  occupied: 'Terisi',
  vacant: 'Kosong',
  booked: 'Dipesan',
  maintenance: 'Perawatan',
  paid: 'Lunas',
  unpaid: 'Belum Bayar',
  overdue: 'Terlambat',
  attended: 'Hadir',
  cancelled: 'Dibatalkan',
  Premium: 'Premium',
  Standard: 'Standard',
  stable: 'Kondisi Stabil',
  'needs-attention': 'Perlu Perhatian',
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
