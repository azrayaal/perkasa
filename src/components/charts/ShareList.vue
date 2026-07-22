<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency, formatPercent } from '@/utils/formatCurrency'
import type { RankedItem } from '@/types'

const props = withDefaults(
  defineProps<{
    items: RankedItem[]
    /** Berapa baris teratas yang ditampilkan; sisanya digabung jadi "Lainnya". */
    limit?: number
  }>(),
  { limit: 6 },
)

/**
 * Peringkat dengan batang proporsi.
 * Sisa data TIDAK dibuang diam-diam | item ke-N ke bawah dilebur menjadi satu
 * baris "Lainnya" supaya jumlahnya tetap utuh 100%.
 */
const rows = computed<RankedItem[]>(() => {
  if (props.items.length <= props.limit) return props.items

  const head = props.items.slice(0, props.limit)
  const tail = props.items.slice(props.limit)

  return [
    ...head,
    {
      id: 'others',
      label: `Lainnya (${tail.length} item)`,
      sublabel: '',
      value: tail.reduce((sum, item) => sum + item.value, 0),
      share: Number(tail.reduce((sum, item) => sum + item.share, 0).toFixed(1)),
    },
  ]
})
</script>

<template>
  <ul class="flex flex-col gap-3">
    <li v-for="row in rows" :key="row.id" class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between gap-3">
        <span class="min-w-0 truncate text-data font-medium text-ink-primary">
          {{ row.label }}
          <span v-if="row.sublabel" class="identifier ml-1">{{ row.sublabel }}</span>
        </span>
        <span class="amount shrink-0 text-data font-semibold text-ink-primary">
          {{ formatCurrency(row.value) }}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
          <div
            class="h-full rounded-full bg-chart-1"
            :class="row.id === 'others' ? 'bg-ink-muted' : ''"
            :style="{ width: `${Math.max(row.share, 1)}%` }"
          />
        </div>
        <span class="amount w-12 shrink-0 text-right text-xs text-ink-secondary">
          {{ formatPercent(row.share) }}
        </span>
      </div>
    </li>
  </ul>
</template>
