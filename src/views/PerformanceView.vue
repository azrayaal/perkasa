<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ShareList from '@/components/charts/ShareList.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { ChartSeries } from '@/components/charts/chart.types'
import { getPerformanceReport } from '@/services/performanceService'
import { getIncomeStatement } from '@/services/reportService'
import { usePeriodStore } from '@/stores/periodStore'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatCurrency'
import type { Aging, FinancialRatio, IncomeStatement, PerformanceReport } from '@/types'

const period = usePeriodStore()

const report = ref<PerformanceReport | null>(null)
const income = ref<IncomeStatement | null>(null)
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true

  const [reportResult, incomeResult] = await Promise.all([
    getPerformanceReport(period.from, period.to),
    getIncomeStatement(period.from, period.to),
  ])

  report.value = reportResult
  income.value = incomeResult
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

const chartLabels = computed(() => (report.value?.monthly ?? []).map((point) => point.label))

const chartSeries = computed<ChartSeries[]>(() => {
  const points = report.value?.monthly ?? []
  return [
    { name: 'Pendapatan', values: points.map((point) => point.revenue) },
    { name: 'HPP + Beban', values: points.map((point) => point.cogs + point.expense) },
    { name: 'Laba Bersih', values: points.map((point) => point.netProfit) },
  ]
})

/** Format nilai rasio mengikuti satuannya | persen, kali, hari, atau kelipatan. */
function ratioValue(row: FinancialRatio): string {
  const decimal = (value: number, digits: number): string =>
    value.toFixed(digits).replace('.', ',')

  switch (row.format) {
    case 'percent':
      return formatPercent(row.value)
    case 'ratio':
      return decimal(row.value, 2)
    case 'days':
      return `${formatNumber(row.value)} hari`
    case 'times':
      return `${decimal(row.value, 1)} kali`
  }
}

/** Sehat = melewati ambang ke arah yang benar sesuai `direction`. */
function isHealthy(row: FinancialRatio): boolean {
  return row.direction === 'higher' ? row.value >= row.benchmark : row.value <= row.benchmark
}

function benchmarkText(row: FinancialRatio): string {
  const target: FinancialRatio = { ...row, value: row.benchmark }
  return `${row.direction === 'higher' ? 'Target minimal' : 'Target maksimal'} ${ratioValue(target)}`
}

/** Lebar bar bucket umur; bar tetap terlihat walau porsinya sangat kecil. */
function bucketWidth(amount: number, aging: Aging): string {
  if (aging.total === 0) return '0%'
  return `${Math.max((amount / aging.total) * 100, amount > 0 ? 1 : 0)}%`
}

function bucketShare(amount: number, aging: Aging): string {
  if (aging.total === 0) return formatPercent(0)
  return formatPercent((amount / aging.total) * 100)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Performa"
      :description="`Rasio dan tren periode ${period.label}, seluruhnya diturunkan dari laporan keuangan yang sama.`"
    />

    <LoadingState v-if="loading" :rows="6" />

    <template v-else-if="report && income">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendapatan Periode"
          :value="formatCurrency(income.revenue.total)"
          icon="sales"
          tone="brand"
          caption="Penjualan bersih sebelum PPN"
        />
        <StatCard
          label="Laba Bersih"
          :value="formatCurrency(income.netProfit)"
          icon="report"
          :tone="income.netProfit >= 0 ? 'success' : 'error'"
          :caption="`Marjin bersih ${formatPercent(income.netMargin)}`"
        />
        <StatCard
          label="Marjin Kotor"
          :value="formatPercent(income.grossMargin)"
          icon="percent"
          :caption="`Laba kotor ${formatCurrency(income.grossProfit)}`"
        />
        <StatCard
          label="Perputaran Persediaan"
          :value="`${report.inventoryTurnover.toFixed(1).replace('.', ',')} kali`"
          icon="warehouse"
          caption="Disetahunkan dari HPP periode"
        />
      </div>

      <BaseCard
        title="Tren Bulanan Tahun Berjalan"
        subtitle="Pendapatan, biaya, dan laba bersih dari jurnal yang sama"
      >
        <TrendChart :labels="chartLabels" :series="chartSeries" />
      </BaseCard>

      <BaseCard
        title="Rasio Keuangan"
        subtitle="Dihitung langsung dari Neraca dan Laba Rugi periode berjalan"
      >
        <ul class="flex flex-col divide-y divide-line">
          <li
            v-for="row in report.ratios"
            :key="row.key"
            class="flex flex-wrap items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
          >
            <div class="min-w-0 flex-1">
              <p class="text-data font-medium text-ink-primary">{{ row.label }}</p>
              <p class="mt-0.5 text-small text-ink-secondary">{{ row.hint }}</p>
              <p class="mt-0.5 text-xs text-ink-muted">{{ benchmarkText(row) }}</p>
            </div>

            <div class="shrink-0 text-right">
              <p class="amount text-h4 text-ink-primary">{{ ratioValue(row) }}</p>
              <!-- Penanda status tidak boleh warna semata: ikon + teks ikut hadir. -->
              <p
                class="mt-1 flex items-center justify-end gap-1.5 text-small font-semibold"
                :class="isHealthy(row) ? 'text-state-success' : 'text-state-warning'"
              >
                <BaseIcon :name="isHealthy(row) ? 'check' : 'alert'" :size="14" />
                {{ isHealthy(row) ? 'Sehat' : 'Perlu perhatian' }}
              </p>
            </div>
          </li>
        </ul>
      </BaseCard>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BaseCard title="Produk Terlaris" subtitle="Berdasarkan nilai penjualan faktur terposting">
          <EmptyState
            v-if="report.topProducts.length === 0"
            title="Belum ada penjualan"
            description="Posting faktur penjualan untuk melihat peringkat produk."
          />
          <ShareList v-else :items="report.topProducts" />
        </BaseCard>

        <BaseCard title="Pelanggan Terbesar" subtitle="Kontribusi DPP terhadap total penjualan">
          <EmptyState
            v-if="report.topCustomers.length === 0"
            title="Belum ada pelanggan aktif"
            description="Peringkat muncul setelah ada faktur yang diposting."
          />
          <ShareList v-else :items="report.topCustomers" />
        </BaseCard>
      </div>

      <BaseCard title="Komposisi Beban" subtitle="Beban operasional menurut akun buku besar">
        <EmptyState
          v-if="report.expenseBreakdown.length === 0"
          title="Belum ada beban tercatat"
          description="Beban yang diposting akan langsung terpetakan ke akunnya."
        />
        <ShareList v-else :items="report.expenseBreakdown" />
      </BaseCard>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BaseCard
          title="Umur Piutang"
          :subtitle="`Total ${formatCurrency(report.receivableAging.total)} belum tertagih`"
        >
          <ul class="flex flex-col gap-3">
            <li
              v-for="bucket in report.receivableAging.buckets"
              :key="bucket.label"
              class="flex flex-col gap-1.5"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-data font-medium text-ink-primary">
                  {{ bucket.label }}
                  <span class="ml-1 text-small font-normal text-ink-secondary">
                    {{ bucket.count }} faktur
                  </span>
                </span>
                <span class="amount shrink-0 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(bucket.amount) }}
                </span>
              </div>

              <div class="flex items-center gap-3">
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    class="h-full rounded-full bg-chart-1"
                    :style="{ width: bucketWidth(bucket.amount, report.receivableAging) }"
                  />
                </div>
                <span class="amount w-12 shrink-0 text-right text-xs text-ink-secondary">
                  {{ bucketShare(bucket.amount, report.receivableAging) }}
                </span>
              </div>
            </li>
          </ul>
        </BaseCard>

        <BaseCard
          title="Umur Utang"
          :subtitle="`Total ${formatCurrency(report.payableAging.total)} belum dibayar`"
        >
          <ul class="flex flex-col gap-3">
            <li
              v-for="bucket in report.payableAging.buckets"
              :key="bucket.label"
              class="flex flex-col gap-1.5"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-data font-medium text-ink-primary">
                  {{ bucket.label }}
                  <span class="ml-1 text-small font-normal text-ink-secondary">
                    {{ bucket.count }} faktur
                  </span>
                </span>
                <span class="amount shrink-0 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(bucket.amount) }}
                </span>
              </div>

              <div class="flex items-center gap-3">
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    class="h-full rounded-full bg-chart-2"
                    :style="{ width: bucketWidth(bucket.amount, report.payableAging) }"
                  />
                </div>
                <span class="amount w-12 shrink-0 text-right text-xs text-ink-secondary">
                  {{ bucketShare(bucket.amount, report.payableAging) }}
                </span>
              </div>
            </li>
          </ul>
        </BaseCard>
      </div>

      <IntegrationNote title="Rasio bukan angka terpisah">
        Marjin kotor {{ formatPercent(income.grossMargin) }} di halaman ini dihitung dari laporan
        keuangan yang sama dengan tab <strong>Laba Rugi</strong>, rasio lancar dan utang–ekuitas dari
        <strong>Neraca</strong>, serta umur piutang/utang dari faktur di modul
        <strong>Penjualan</strong> dan <strong>Pembelian</strong>. Tidak ada satu pun indikator di
        sini yang punya sumber data sendiri.
      </IntegrationNote>
    </template>
  </div>
</template>
