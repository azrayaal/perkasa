<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TrendChart from '@/components/charts/TrendChart.vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { ChartSeries } from '@/components/charts/chart.types'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import type { TabItem } from '@/components/ui/BaseTabs.types'
import { getTaxOverview } from '@/services/taxService'
import { ROUTE } from '@/router/routeNames'
import { usePeriodStore } from '@/stores/periodStore'
import { periodLabelLong, periodOf } from '@/utils/date'
import { formatCurrency, formatPercent } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { TaxOverview, VatPeriodSummary } from '@/types'

const router = useRouter()
const period = usePeriodStore()

const overview = ref<TaxOverview | null>(null)
const loading = ref(true)
const activeTab = ref('ppn')

/**
 * SPT selalu dilaporkan per masa pajak. Saat periode aktif berupa tahun
 * berjalan, masa yang disajikan adalah bulan terakhir dari rentang itu.
 */
const filingPeriod = computed(() => periodOf(period.to))

async function load(): Promise<void> {
  loading.value = true
  overview.value = await getTaxOverview(filingPeriod.value)
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

const tabs = computed<TabItem[]>(() => [
  { key: 'ppn', label: 'PPN' },
  { key: 'pph', label: 'PPh Potong-Pungut' },
  { key: 'badan', label: 'PPh Badan' },
])

const vatSeries = computed<ChartSeries[]>(() => {
  const trend = overview.value?.vatTrend ?? []
  return [
    { name: 'PPN Keluaran', values: trend.map((item) => item.outputVat) },
    { name: 'PPN Masukan', values: trend.map((item) => item.inputVat) },
  ]
})

const vatLabels = computed(() => (overview.value?.vatTrend ?? []).map((item) => item.label))

const vatColumns: TableColumn<VatPeriodSummary>[] = [
  { key: 'label', label: 'Masa Pajak' },
  { key: 'outputBase', label: 'DPP Penyerahan', align: 'right' },
  { key: 'outputVat', label: 'PPN Keluaran', align: 'right' },
  { key: 'inputBase', label: 'DPP Perolehan', align: 'right' },
  { key: 'inputVat', label: 'PPN Masukan', align: 'right' },
  { key: 'payable', label: 'Kurang/Lebih Bayar', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
]

function openInvoice(id: string): void {
  void router.push({ name: ROUTE.salesDetail, params: { id } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Perpajakan"
      :description="`SPT Masa ${periodLabelLong(filingPeriod)}. Seluruh angka ditarik dari faktur dan beban — tidak ada input pajak terpisah.`"
    />

    <LoadingState v-if="loading || !overview" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="PPN Masa Ini"
          :value="formatCurrency(Math.abs(overview.vat.payable))"
          icon="tax"
          tone="brand"
          :caption="overview.vat.label"
        />
        <StatCard
          label="PPN Keluaran"
          :value="formatCurrency(overview.vat.outputVat)"
          icon="sales"
          caption="Dari faktur penjualan yang diposting"
        />
        <StatCard
          label="PPN Masukan"
          :value="formatCurrency(overview.vat.inputVat)"
          icon="purchase"
          caption="Dari faktur pembelian & beban ber-PPN"
        />
        <StatCard
          label="Total Utang Pajak"
          :value="formatCurrency(overview.taxLiability)"
          icon="balance"
          caption="Saldo kelompok utang pajak di Neraca"
        />
      </div>

      <BaseCard flush>
        <template #header>
          <div class="flex w-full flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-h3 text-ink-primary">Status SPT Masa PPN</h2>
              <p class="mt-1 text-small text-ink-secondary">{{ overview.vat.label }}</p>
            </div>
            <BaseBadge :status="overview.vat.status" />
          </div>
        </template>

        <div class="px-4">
          <BaseTabs v-model="activeTab" :tabs="tabs" />
        </div>

        <!-- Tab PPN -->
        <div v-if="activeTab === 'ppn'" class="flex flex-col gap-6 pt-4">
          <BaseTable
            :columns="vatColumns"
            :rows="overview.vatTrend"
            :row-key="(row) => row.period"
          >
            <template #cell-label="{ row }">
              <span class="font-medium text-ink-primary">{{ row.label }}</span>
              <span class="identifier block text-xs">{{ row.period }}</span>
            </template>

            <template #cell-outputBase="{ row }">
              <span class="amount">{{ formatCurrency(row.outputBase) }}</span>
            </template>

            <template #cell-outputVat="{ row }">
              <span class="amount">{{ formatCurrency(row.outputVat) }}</span>
            </template>

            <template #cell-inputBase="{ row }">
              <span class="amount">{{ formatCurrency(row.inputBase) }}</span>
            </template>

            <template #cell-inputVat="{ row }">
              <span class="amount">{{ formatCurrency(row.inputVat) }}</span>
            </template>

            <template #cell-payable="{ row }">
              <span class="amount font-semibold">{{ formatCurrency(Math.abs(row.payable)) }}</span>
            </template>

            <template #cell-status="{ row }">
              <BaseBadge :status="row.status" />
            </template>

            <template #empty>
              <div class="px-4 pb-4">
                <EmptyState title="Belum ada masa pajak" description="Belum ada transaksi tahun ini." />
              </div>
            </template>
          </BaseTable>

          <div class="px-4">
            <p class="mb-3 text-h4 text-ink-primary">PPN Keluaran vs PPN Masukan</p>
            <TrendChart :labels="vatLabels" :series="vatSeries" />
          </div>

          <div class="flex flex-col gap-3 px-4 pb-4">
            <p class="text-h4 text-ink-primary">Faktur Pajak Belum Bernomor</p>

            <BaseCallout
              v-if="overview.pendingTaxInvoices.length > 0"
              tone="warning"
              title="Ada faktur keluaran tanpa nomor seri"
            >
              {{ overview.pendingTaxInvoices.length }} faktur sudah diposting tetapi belum diberi nomor
              faktur pajak. Selama nomornya kosong, PPN-nya tetap terutang namun tidak sah dilaporkan.
            </BaseCallout>

            <ul v-if="overview.pendingTaxInvoices.length > 0" class="flex flex-col gap-2">
              <li
                v-for="invoice in overview.pendingTaxInvoices"
                :key="invoice.id"
                class="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-control border border-line px-4 py-3 transition-colors hover:bg-surface-alt"
                @click="openInvoice(invoice.id)"
              >
                <div class="min-w-0">
                  <span class="identifier">{{ invoice.number }}</span>
                  <span class="block text-xs text-ink-muted">
                    {{ invoice.customerName }} · {{ formatDate(invoice.date) }}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="amount text-data font-semibold text-ink-primary">
                    {{ formatCurrency(invoice.ppn) }}
                  </span>
                  <BaseIcon name="forward" :size="16" class="text-ink-muted" />
                </div>
              </li>
            </ul>

            <EmptyState
              v-else
              title="Semua faktur sudah bernomor"
              description="Tidak ada faktur keluaran yang tertinggal tanpa nomor seri pajak."
            />
          </div>
        </div>

        <!-- Tab PPh Potong-Pungut -->
        <div v-else-if="activeTab === 'pph'" class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
          <div
            v-for="item in overview.withholdings"
            :key="item.type"
            class="flex flex-col gap-3 rounded-card border border-line p-4"
          >
            <div>
              <p class="text-h4 text-ink-primary">{{ item.label }}</p>
              <p class="mt-1 text-small text-ink-secondary">{{ item.rateLabel }}</p>
            </div>

            <dl class="flex flex-col gap-2 text-data">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-secondary">Jumlah transaksi</dt>
                <dd class="amount text-ink-primary">{{ item.count }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-secondary">Dasar pengenaan</dt>
                <dd class="amount text-ink-primary">{{ formatCurrency(item.base) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt class="font-medium text-ink-primary">Dipotong</dt>
                <dd class="amount font-semibold text-ink-primary">{{ formatCurrency(item.amount) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Tab PPh Badan -->
        <div v-else class="p-4">
          <dl class="flex flex-col divide-y divide-line rounded-card border border-line">
            <div class="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt class="text-data text-ink-secondary">Laba sebelum pajak (tahun berjalan)</dt>
              <dd class="amount text-data font-semibold text-ink-primary">
                {{ formatCurrency(overview.corporate.profitBeforeTax) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt class="text-data text-ink-secondary">Tarif PPh badan efektif</dt>
              <dd class="amount text-data text-ink-primary">
                {{ formatPercent(overview.corporate.rate) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 bg-surface-alt px-4 py-3">
              <dt class="text-data font-medium text-ink-primary">Taksiran PPh terutang</dt>
              <dd class="amount text-data font-semibold text-ink-primary">
                {{ formatCurrency(overview.corporate.estimatedTax) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt class="text-data text-ink-secondary">Dikurangi angsuran PPh 25 yang telah disetor</dt>
              <dd class="amount text-data text-ink-primary">
                {{ formatCurrency(overview.corporate.prepaid) }}
              </dd>
            </div>
            <div class="flex flex-wrap items-baseline justify-between gap-4 px-4 py-4">
              <dt class="text-data font-semibold text-ink-primary">
                {{ overview.corporate.payable >= 0 ? 'PPh 29 kurang bayar akhir tahun' : 'Lebih bayar akhir tahun' }}
              </dt>
              <dd class="amount text-h3 text-ink-primary">
                {{ formatCurrency(Math.abs(overview.corporate.payable)) }}
              </dd>
            </div>
          </dl>

          <p class="mt-3 text-small text-ink-secondary">
            Laba sebelum pajak diambil langsung dari Laporan Laba Rugi tahun berjalan, sehingga
            taksiran ini ikut bergerak setiap ada faktur atau beban baru.
          </p>
        </div>
      </BaseCard>

      <IntegrationNote title="SPT bukan formulir terpisah">
        Seluruh angka di halaman ini ditarik dari <strong>faktur penjualan</strong>,
        <strong>faktur pembelian</strong>, dan <strong>beban</strong> — tidak ada satu pun nilai pajak
        yang diinput sendiri di sini. Konsekuensinya jujur: kalau ada faktur yang salah, SPT-nya ikut
        salah, dan memperbaikinya harus di dokumen sumbernya, bukan di laporan pajak.
      </IntegrationNote>
    </template>
  </div>
</template>
