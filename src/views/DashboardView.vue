<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TrendChart from '@/components/charts/TrendChart.vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import {
  getDashboardStats,
  getIntegrityChecks,
  getOverdueInvoices,
  getRecentTimeline,
  type IntegrityCheck,
} from '@/services/dashboardService'
import { buildMonthlySeries } from '@/services/performanceService'
import { ROUTE } from '@/router/routeNames'
import { useAuthStore } from '@/stores/authStore'
import { usePeriodStore } from '@/stores/periodStore'
import { formatCurrency, formatCurrencyShort, formatNumber } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { DashboardStats, MonthlyPoint, TimelineEntry } from '@/types'

const auth = useAuthStore()
const period = usePeriodStore()
const router = useRouter()

const stats = ref<DashboardStats | null>(null)
const timeline = ref<TimelineEntry[]>([])
const monthly = ref<MonthlyPoint[]>([])
const overdue = ref<Awaited<ReturnType<typeof getOverdueInvoices>>>([])
const integrity = ref<IntegrityCheck[]>([])
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true

  const [statsResult, timelineResult, overdueResult, integrityResult] = await Promise.all([
    getDashboardStats(period.from, period.to),
    getRecentTimeline(8),
    getOverdueInvoices(5),
    getIntegrityChecks(period.to),
  ])

  stats.value = statsResult
  timeline.value = timelineResult
  overdue.value = overdueResult
  integrity.value = integrityResult
  monthly.value = buildMonthlySeries(period.to)
  loading.value = false
}

// Ganti periode di topbar -> seluruh angka dashboard ikut dihitung ulang.
watch(() => [period.from, period.to], load, { immediate: true })

const chartSeries = computed(() => [
  { name: 'Pendapatan', values: monthly.value.map((point) => point.revenue) },
  { name: 'HPP + Beban', values: monthly.value.map((point) => point.cogs + point.expense) },
  { name: 'Laba Bersih', values: monthly.value.map((point) => point.netProfit) },
])

const chartLabels = computed(() => monthly.value.map((point) => point.label))

const allBalanced = computed(() => integrity.value.every((check) => check.difference === 0))

function openTimeline(entry: TimelineEntry): void {
  if (!entry.routeName) return
  void router.push({ name: entry.routeName, params: entry.routeParams ?? undefined })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      :title="`Halo, ${auth.user?.name.split(' ')[0] ?? ''}`"
      :description="`Ringkasan kinerja PT Perkasa Gemilang Distrindo — periode ${period.label}.`"
    />

    <LoadingState v-if="loading" :rows="6" />

    <template v-else-if="stats">
      <!-- Baris 1: hasil usaha -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendapatan"
          :value="formatCurrency(stats.revenue)"
          icon="sales"
          tone="brand"
          :trend="stats.revenueGrowth"
          caption="vs periode sebelumnya"
        />
        <StatCard
          label="Laba Kotor"
          :value="formatCurrency(stats.grossProfit)"
          icon="performance"
          :caption="`Marjin ${((stats.grossProfit / (stats.revenue || 1)) * 100).toFixed(1)}%`"
        />
        <StatCard
          label="Laba Bersih"
          :value="formatCurrency(stats.netProfit)"
          icon="report"
          :tone="stats.netProfit >= 0 ? 'success' : 'error'"
          :caption="`Marjin bersih ${stats.netMargin.toFixed(1)}%`"
        />
        <StatCard
          label="Kas & Bank"
          :value="formatCurrency(stats.cashBalance)"
          icon="cash"
          caption="Saldo seluruh rekening"
        />
      </div>

      <!-- Baris 2: posisi keuangan & peringatan -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Piutang Usaha"
          :value="formatCurrency(stats.receivable)"
          icon="users"
          :tone="stats.overdueReceivable > 0 ? 'warning' : 'plain'"
          :caption="`${formatCurrency(stats.overdueReceivable)} jatuh tempo`"
        />
        <StatCard
          label="Utang Usaha"
          :value="formatCurrency(stats.payable)"
          icon="purchase"
          caption="Kewajiban ke pemasok"
        />
        <StatCard
          label="Nilai Persediaan"
          :value="formatCurrency(stats.inventoryValue)"
          icon="warehouse"
          :tone="stats.lowStockCount > 0 ? 'warning' : 'plain'"
          :caption="`${stats.lowStockCount} SKU perlu restock`"
        />
        <StatCard
          label="PPN Kurang Bayar"
          :value="formatCurrency(stats.vatPayable)"
          icon="tax"
          caption="Keluaran dikurangi masukan"
        />
        <StatCard
          label="Omzet Kasir"
          :value="formatCurrency(stats.posRevenue)"
          icon="pos"
          :tone="stats.openShiftCount > 0 ? 'warning' : 'plain'"
          :caption="
            stats.openShiftCount > 0
              ? `${stats.openShiftCount} shift belum ditutup`
              : 'Seluruh shift sudah disetor'
          "
        />
      </div>

      <BaseCard
        title="Tren Bulanan Tahun Berjalan"
        subtitle="Pendapatan, biaya, dan laba bersih dari jurnal yang sama"
      >
        <TrendChart :labels="chartLabels" :series="chartSeries" />
      </BaseCard>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BaseCard
          class="xl:col-span-2"
          title="Linimasa Transaksi"
          subtitle="Seluruh modul mengalir ke satu buku"
          flush
        >
          <EmptyState
            v-if="timeline.length === 0"
            title="Belum ada transaksi"
            description="Faktur, beban, dan mutasi kas akan muncul di sini."
          />

          <ul v-else class="divide-y divide-line">
            <li
              v-for="entry in timeline"
              :key="entry.id"
              class="flex items-start gap-4 px-5 py-3.5 transition-colors"
              :class="entry.routeName ? 'cursor-pointer hover:bg-surface-alt' : ''"
              @click="openTimeline(entry)"
            >
              <BaseBadge :status="entry.source" class="mt-0.5 shrink-0" />

              <div class="min-w-0 flex-1">
                <p class="truncate text-data font-medium text-ink-primary">{{ entry.title }}</p>
                <p class="truncate text-sm text-ink-secondary">{{ entry.subtitle }}</p>
              </div>

              <div class="shrink-0 text-right">
                <p class="amount text-data font-semibold text-ink-primary">
                  {{ formatCurrencyShort(entry.amount) }}
                </p>
                <p class="text-xs text-ink-muted">{{ formatDate(entry.date) }}</p>
              </div>
            </li>
          </ul>
        </BaseCard>

        <div class="flex flex-col gap-4">
          <BaseCard title="Piutang Jatuh Tempo" subtitle="Perlu ditagih lebih dulu" flush>
            <EmptyState
              v-if="overdue.length === 0"
              title="Tidak ada tunggakan"
              description="Seluruh faktur masih dalam termin."
            />

            <ul v-else class="divide-y divide-line">
              <li
                v-for="row in overdue"
                :key="row.id"
                class="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-alt"
                @click="router.push({ name: ROUTE.salesDetail, params: { id: row.id } })"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-data font-medium text-ink-primary">{{ row.customerName }}</p>
                  <p class="identifier truncate">{{ row.number }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="amount text-data font-semibold text-ink-primary">
                    {{ formatCurrencyShort(row.outstanding) }}
                  </p>
                  <p class="text-xs text-state-error">{{ formatNumber(row.overdueDays) }} hari</p>
                </div>
              </li>
            </ul>
          </BaseCard>

          <!--
            Uji rekonsiliasi: membuktikan modul operasional dan pembukuan
            memang membaca sumber yang sama, bukan sekadar diklaim.
          -->
          <BaseCard title="Uji Konsistensi Data">
            <template #actions>
              <BaseBadge :status="allBalanced ? 'balanced' : 'unbalanced'" />
            </template>

            <ul class="flex flex-col gap-3">
              <li v-for="check in integrity" :key="check.key" class="flex items-start gap-3">
                <BaseIcon
                  :name="check.difference === 0 ? 'check' : 'alert'"
                  :size="16"
                  class="mt-1 shrink-0"
                  :class="check.difference === 0 ? 'text-state-success' : 'text-state-error'"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-data font-medium text-ink-primary">{{ check.label }}</p>
                  <p class="text-xs text-ink-secondary">
                    {{ check.moduleLabel }} = {{ check.ledgerLabel }}
                  </p>
                  <p class="amount mt-0.5 text-sm text-ink-primary">
                    {{ formatCurrency(check.moduleValue) }}
                  </p>
                </div>
              </li>
            </ul>
          </BaseCard>
        </div>
      </div>

      <IntegrationNote title="Bagaimana angka di halaman ini terbentuk">
        Setiap faktur penjualan yang diposting langsung mengurangi stok gudang, membentuk jurnal
        Piutang–Penjualan–PPN dan HPP–Persediaan, lalu mengalir ke Neraca, Laba Rugi, Arus Kas, dan
        SPT Masa PPN. Tidak ada angka di dashboard ini yang diketik ulang di tempat lain.
      </IntegrationNote>
    </template>
  </div>
</template>
