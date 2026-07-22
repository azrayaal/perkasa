<script setup lang="ts">
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatDate } from '@/utils/formatDate'
import type { HealthSummary } from '@/types'

/**
 * Versi ringkas kesehatan untuk Family Portal.
 * Hanya level kondisi — tekanan darah, detak jantung, dan catatan medis
 * sudah dipangkas di service layer dan tidak pernah dikirim ke view ini.
 */
defineProps<{
  summary: HealthSummary | null
}>()
</script>

<template>
  <BaseCard title="Ringkasan Kesehatan">
    <EmptyState
      v-if="!summary || !summary.lastCheckDate"
      title="Belum ada pemeriksaan"
      description="Caregiver belum melakukan pencatatan untuk penghuni ini."
    />

    <div v-else class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <BaseBadge :status="summary.level" />
        <p class="mt-2 text-sm text-ink-secondary">
          Pemeriksaan terakhir {{ formatDate(summary.lastCheckDate) }}
          <template v-if="summary.caregiver"> oleh {{ summary.caregiver }}</template>
        </p>
      </div>

      <p class="max-w-xs text-sm text-ink-muted">
        Detail medis hanya dapat diakses oleh tim care Ginkgo Living.
      </p>
    </div>
  </BaseCard>
</template>
