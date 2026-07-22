/** Definisi kolom `BaseTable`. Dipisah dari SFC supaya bisa di-import type-only. */
export interface TableColumn<T> {
  /** Key unik kolom; juga dipakai sebagai nama slot sel: `#cell-<key>`. */
  key: string
  label: string
  align?: 'left' | 'right'
  /** Nilai default sel kalau slot `#cell-<key>` tidak disediakan. */
  value?: (row: T) => string | number
}
