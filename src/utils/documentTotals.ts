/**
 * Hitung nilai faktur dari baris barangnya.
 *
 * Satu-satunya tempat rumus DPP & PPN hidup. Baik seeder maupun form entri
 * memanggil fungsi ini, jadi mustahil ada faktur yang totalnya "diketik" dan
 * berbeda dari rinciannya.
 */
import type { DocumentLine, DocumentTotals } from '@/types'

export function calcTotals(lines: DocumentLine[], vatRatePercent: number): DocumentTotals {
  let gross = 0
  let discount = 0

  for (const line of lines) {
    const lineGross = line.qty * line.unitPrice
    gross += lineGross
    discount += Math.round((lineGross * line.discountPercent) / 100)
  }

  const dpp = gross - discount
  const ppn = Math.round((dpp * vatRatePercent) / 100)

  return { gross, discount, dpp, ppn, total: dpp + ppn }
}

/** Nilai satu baris setelah diskon, sebelum PPN. */
export function lineAmount(line: DocumentLine): number {
  const gross = line.qty * line.unitPrice
  return gross - Math.round((gross * line.discountPercent) / 100)
}
