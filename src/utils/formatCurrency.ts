const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Format angka rupiah, contoh: 9700000 -> "Rp 9.700.000". */
export function formatCurrency(value: number): string {
  // Intl menempel "Rp9.700.000" tanpa spasi — normalkan supaya lebih terbaca.
  const formatted = IDR_FORMATTER.format(Math.round(value)).replace(/^Rp\s?/, 'Rp ')
  // Nilai negatif ditulis "-Rp 1.000", bukan "Rp -1.000".
  return formatted.replace('Rp -', '-Rp ')
}

/**
 * Rupiah ringkas untuk kartu statistik & sumbu grafik: 1.850.000.000 -> "Rp 1,85 M".
 * Dipakai saat ruang sempit dan pembaca hanya butuh besaran, bukan angka persis.
 */
export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} M`
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`
  return `${sign}Rp ${abs}`
}

/** Angka biasa (kuantitas stok, jumlah dokumen). */
export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value)
}

/** Persentase dengan satu desimal, contoh: 22.5 -> "22,5%". */
export function formatPercent(value: number, withSign = false): string {
  const sign = withSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1).replace('.', ',')}%`
}
