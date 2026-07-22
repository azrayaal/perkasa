<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatCurrency } from '@/utils/formatCurrency'
import type { BillingSummary } from '@/types'

/**
 * Versi ringkas billing untuk Family Portal: total & status saja.
 * Breakdown rent/careFee sengaja tidak pernah ditampilkan di sini.
 */
defineProps<{
  summary: BillingSummary | null
}>()
</script>

<template>
  <BaseCard title="Ringkasan Tagihan">
    <EmptyState
      v-if="!summary || summary.invoiceCount === 0"
      title="Belum ada tagihan"
      description="Tagihan akan tampil setelah periode penagihan pertama."
    />

    <div v-else class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Tagihan belum dibayar
        </p>
        <p class="mt-1 text-2xl font-bold text-ink-primary">
          {{ formatCurrency(summary.outstandingTotal) }}
        </p>
        <p class="mt-1 text-sm text-ink-secondary">
          Periode terakhir: {{ summary.latestPeriod ?? '—' }}
        </p>
      </div>

      <BaseBadge v-if="summary.status" :status="summary.status" />
    </div>
  </BaseCard>
</template>
