import { EMPTY } from '@/utils/placeholder'

const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const PLACEHOLDER = EMPTY

/** Format ISO date string ke format lokal, contoh: "2026-07-20" -> "20 Jul 2026". */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return PLACEHOLDER

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return PLACEHOLDER

  return DATE_FORMATTER.format(parsed)
}
