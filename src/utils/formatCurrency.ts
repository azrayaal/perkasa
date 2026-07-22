const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Format angka rupiah, contoh: 9700000 -> "Rp 9.700.000". */
export function formatCurrency(value: number): string {
  // Intl menempel "Rp9.700.000" tanpa spasi — normalkan supaya lebih terbaca.
  return IDR_FORMATTER.format(value).replace(/^Rp\s?/, 'Rp ')
}
