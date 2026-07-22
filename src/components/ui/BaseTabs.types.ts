/** Definisi tab `BaseTabs`. Dipisah dari SFC supaya bisa di-import type-only. */
export interface TabItem {
  key: string
  label: string
  /** Angka kecil di sebelah label, mis. jumlah baris. */
  count?: number
}
