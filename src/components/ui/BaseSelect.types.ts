/** Opsi `BaseSelect`. Dipisah dari SFC karena `<script setup>` tidak boleh meng-export. */
export interface SelectOption<TValue> {
  value: TValue
  label: string
}
