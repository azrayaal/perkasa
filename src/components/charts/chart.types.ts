/** Satu seri data grafik. Dipisah dari SFC supaya bisa di-import type-only. */
export interface ChartSeries {
  name: string
  values: number[]
}
