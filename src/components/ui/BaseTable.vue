<script setup lang="ts" generic="T">
import type { TableColumn } from '@/components/ui/BaseTable.types'

const props = withDefaults(
  defineProps<{
    columns: TableColumn<T>[]
    rows: T[]
    rowKey: (row: T) => string
    /** Aktifkan kursor pointer + emit `rowClick`. */
    clickable?: boolean
  }>(),
  { clickable: false },
)

const emit = defineEmits<{
  rowClick: [row: T]
}>()

/**
 * Slot per-sel: `#cell-<column.key>`. Kalau tidak diisi, dipakai `column.value(row)`.
 * Slot `empty` dipakai saat `rows` kosong (biasanya diisi `<EmptyState />`).
 */
defineSlots<{
  empty?: () => unknown
  [key: `cell-${string}`]: (props: { row: T }) => unknown
}>()

function cellText(column: TableColumn<T>, row: T): string {
  const value = column.value?.(row)
  return value === undefined || value === null || value === '' ? '|' : String(value)
}

function alignClass(column: TableColumn<T>): string {
  return column.align === 'right' ? 'text-right' : 'text-left'
}

function handleRowClick(row: T): void {
  if (props.clickable) emit('rowClick', row)
}
</script>

<template>
  <slot v-if="rows.length === 0" name="empty" />

  <template v-else>
    <!-- Desktop: tabel biasa -->
    <div class="hidden overflow-x-auto md:block">
      <table class="w-full border-collapse text-data">
        <thead>
          <tr class="border-b border-line">
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              :class="alignClass(column)"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            class="border-b border-line last:border-b-0"
            :class="clickable ? 'cursor-pointer transition-colors hover:bg-surface-alt' : ''"
            @click="handleRowClick(row)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-4 align-middle text-ink-primary"
              :class="alignClass(column)"
            >
              <slot :name="`cell-${column.key}`" :row="row">{{ cellText(column, row) }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile: card stack, tetap terbaca di layar sempit -->
    <ul class="flex flex-col gap-3 px-4 pb-1 md:hidden">
      <li
        v-for="row in rows"
        :key="rowKey(row)"
        class="rounded-control border border-line p-4"
        :class="clickable ? 'cursor-pointer active:bg-surface-alt' : ''"
        @click="handleRowClick(row)"
      >
        <dl class="flex flex-col gap-2">
          <div
            v-for="column in columns"
            :key="column.key"
            class="flex items-start justify-between gap-4"
          >
            <dt class="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {{ column.label }}
            </dt>
            <dd class="text-right text-data text-ink-primary">
              <slot :name="`cell-${column.key}`" :row="row">{{ cellText(column, row) }}</slot>
            </dd>
          </div>
        </dl>
      </li>
    </ul>
  </template>
</template>
