<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { getDashboardStats, getRecentTimeline } from '@/services/dashboardService'
import { ROUTE } from '@/router/routeNames'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { useAuthStore } from '@/stores/authStore'
import type { DashboardStats, TimelineEntry } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const stats = ref<DashboardStats | null>(null)
const timeline = ref<TimelineEntry[]>([])
const loading = ref(true)

const SOURCE_LABEL: Record<TimelineEntry['source'], string> = {
  billing: 'Billing',
  ehr: 'Kesehatan',
  activity: 'Aktivitas',
}

const SOURCE_CLASS: Record<TimelineEntry['source'], string> = {
  billing: 'bg-brand/25 text-ink-primary',
  ehr: 'bg-state-error/10 text-state-error',
  activity: 'bg-ink-strong/[0.07] text-ink-primary',
}

onMounted(async () => {
  const [statsResult, timelineResult] = await Promise.all([getDashboardStats(), getRecentTimeline()])
  stats.value = statsResult
  timeline.value = timelineResult
  loading.value = false
})

function openResident(residentId: string): void {
  void router.push({ name: ROUTE.residentDetail, params: { id: residentId } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      :title="`Halo, ${auth.user?.name.split(' ')[0] ?? ''}`"
      description="Ringkasan operasional Ginkgo Living hari ini."
    />

    <LoadingState v-if="loading" :rows="5" />

    <template v-else-if="stats">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Penghuni Aktif"
          :value="`${stats.activeResidents} / ${stats.totalResidents}`"
          caption="Terdaftar di sistem"
          icon="residents"
        />
        <StatCard
          label="Okupansi Unit"
          :value="`${stats.occupiedUnits} / ${stats.totalUnits}`"
          caption="Unit terisi"
          icon="unit"
          tone="accent"
        />
        <StatCard
          label="Tagihan Tertunggak"
          :value="formatCurrency(stats.outstandingAmount)"
          :caption="`${stats.unpaidInvoiceCount} invoice belum lunas`"
          icon="billing"
          tone="warning"
        />
        <StatCard
          label="Perlu Perhatian"
          :value="String(stats.residentsNeedingAttention)"
          caption="Penghuni butuh tindak lanjut care"
          icon="health"
          tone="success"
        />
      </div>

      <BaseCard title="Linimasa Terbaru" subtitle="Gabungan peristiwa dari seluruh modul" flush>
        <EmptyState
          v-if="timeline.length === 0"
          title="Belum ada aktivitas tercatat"
          description="Peristiwa dari billing, kesehatan, dan aktivitas akan muncul di sini."
        />

        <ul v-else class="divide-y divide-line">
          <li
            v-for="entry in timeline"
            :key="entry.id"
            class="flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-alt"
            @click="openResident(entry.residentId)"
          >
            <span
              class="mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              :class="SOURCE_CLASS[entry.source]"
            >
              {{ SOURCE_LABEL[entry.source] }}
            </span>

            <div class="min-w-0 flex-1">
              <p class="truncate text-data font-medium text-ink-primary">{{ entry.description }}</p>
              <p class="text-sm text-ink-secondary">{{ entry.residentName }}</p>
            </div>

            <span class="shrink-0 text-sm text-ink-muted">{{ formatDate(entry.date) }}</span>
          </li>
        </ul>
      </BaseCard>

      <BaseCard title="Status Penghuni" subtitle="Distribusi keanggotaan">
        <div class="flex flex-wrap gap-3">
          <BaseBadge status="active" :label="`${stats.activeResidents} Aktif`" />
          <BaseBadge
            status="pending"
            :label="`${stats.totalResidents - stats.activeResidents} Non-aktif / Menunggu`"
          />
        </div>
      </BaseCard>
      <!-- EXTENSION POINT: tambah widget dashboard baru di sini. -->
    </template>
  </div>
</template>
