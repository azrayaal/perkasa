<script setup lang="ts">
/**
 * Shift & setoran kasir | pertanggungjawaban uang fisik di laci konter.
 *
 * Tabel di bawah membaca ringkasan shift apa adanya dari service: kas seharusnya
 * dihitung ulang dari transaksi, bukan diketik, sehingga selisih hitung fisik
 * tidak bisa disembunyikan. Klik satu baris untuk membuka laporan tutup kasir
 * (Z-report) yang menjabarkan aritmetika kasnya baris demi baris.
 */
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { getShiftSummaries } from '@/services/posService'
import { usePeriodStore } from '@/stores/periodStore'
import { formatCurrency, formatNumber } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { PosShiftSummary } from '@/types'
import { EMPTY } from '@/utils/placeholder'

const period = usePeriodStore()

const rows = ref<PosShiftSummary[]>([])
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getShiftSummaries(period.from, period.to)
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

const openShifts = computed(() => rows.value.filter((row) => row.shift.status === 'open'))

const summary = computed(() => ({
  openCount: openShifts.value.length,
  deposited: rows.value.reduce((sum, row) => sum + row.shift.depositedAmount, 0),
  difference: rows.value.reduce((sum, row) => sum + row.cashDifference, 0),
  mdrFee: rows.value.reduce((sum, row) => sum + row.mdrFee, 0),
}))

/** Nama kasir yang lacinya masih terbuka | disebut di callout peringatan. */
const openCashierNames = computed(() =>
  openShifts.value.map((row) => row.shift.cashierName).join(', '),
)

const columns: TableColumn<PosShiftSummary>[] = [
  { key: 'number', label: 'No. Shift' },
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.shift.date) },
  { key: 'cashier', label: 'Kasir' },
  { key: 'hours', label: 'Jam' },
  { key: 'transactions', label: 'Transaksi', align: 'right' },
  { key: 'cashSales', label: 'Penjualan Tunai', align: 'right' },
  { key: 'nonCashSales', label: 'Non-Tunai', align: 'right' },
  { key: 'expectedCash', label: 'Kas Seharusnya', align: 'right' },
  { key: 'countedCash', label: 'Hitung Fisik', align: 'right' },
  { key: 'difference', label: 'Selisih', align: 'right' },
  { key: 'deposited', label: 'Setoran', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
]

/** Warna selisih kas: merah bila kurang, hijau bila lebih, netral bila pas. */
function differenceClass(value: number): string {
  if (value < 0) return 'text-state-error'
  if (value > 0) return 'text-state-success'
  return 'text-ink-primary'
}

function differenceText(value: number): string {
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)
}

/* -------------------------------------------------------------------------- */
/* Laporan tutup kasir (Z-report)                                              */
/* -------------------------------------------------------------------------- */

const reportOpen = ref(false)
const selected = ref<PosShiftSummary | null>(null)

function openReport(row: PosShiftSummary): void {
  selected.value = row
  reportOpen.value = true
}

function closeReport(): void {
  reportOpen.value = false
  selected.value = null
}

/** Uang yang tetap tinggal di laci sebagai modal esok hari. */
const cashLeftInDrawer = computed(() => {
  const shift = selected.value?.shift
  if (!shift || shift.countedCash === null) return null
  return shift.countedCash - shift.depositedAmount
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Shift & Setoran Kasir"
      :description="`Rekap laci kasir periode ${period.label}. Setiap shift menutup dengan hitung fisik, sehingga uang konter selalu ada penanggung jawabnya.`"
    />

    <LoadingState v-if="loading" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shift Terbuka"
          :value="formatNumber(summary.openCount)"
          icon="drawer"
          :tone="summary.openCount > 0 ? 'warning' : 'plain'"
          caption="Laci yang belum dihitung dan disetor"
        />
        <StatCard
          label="Total Setoran"
          :value="formatCurrency(summary.deposited)"
          icon="cash"
          tone="brand"
          caption="Uang laci yang sudah masuk bank"
        />
        <StatCard
          label="Akumulasi Selisih Kas"
          :value="differenceText(summary.difference)"
          icon="alert"
          :tone="summary.difference < 0 ? 'error' : 'plain'"
          caption="Masuk Laba Rugi lewat akun 7200"
        />
        <StatCard
          label="Biaya MDR Periode"
          :value="formatCurrency(summary.mdrFee)"
          icon="performance"
          caption="Potongan penyelenggara QRIS & debit"
        />
      </div>

      <BaseCallout v-if="openShifts.length > 0" tone="warning" title="Masih ada laci yang terbuka">
        {{ formatNumber(openShifts.length) }} shift belum ditutup atas nama
        <strong>{{ openCashierNames }}</strong
        >. Uangnya masih dipegang kasir dan belum dihitung fisik, jadi kas seharusnya pada baris itu
        belum bisa dibandingkan dengan apa pun — tutup shift dulu supaya setorannya terbukukan.
      </BaseCallout>

      <BaseCard flush>
        <BaseTable
          :columns="columns"
          :rows="rows"
          :row-key="(row) => row.shift.id"
          clickable
          @row-click="openReport"
        >
          <template #cell-number="{ row }">
            <span class="identifier">{{ row.shift.number }}</span>
          </template>

          <template #cell-cashier="{ row }">
            <span class="font-medium text-ink-primary">{{ row.shift.cashierName }}</span>
            <span class="block text-xs text-ink-muted">{{ row.warehouseName }}</span>
          </template>

          <template #cell-hours="{ row }">
            <span class="amount text-ink-primary">
              {{ row.shift.openedAt }} s/d {{ row.shift.closedAt ?? '…' }}
            </span>
            <span v-if="row.shift.status === 'open'" class="block text-xs text-state-warning">
              masih buka
            </span>
          </template>

          <template #cell-transactions="{ row }">
            <span class="amount">{{ formatNumber(row.transactionCount) }}</span>
          </template>

          <template #cell-cashSales="{ row }">
            <span class="amount">{{ formatCurrency(row.cashSales) }}</span>
          </template>

          <template #cell-nonCashSales="{ row }">
            <span class="amount">{{ formatCurrency(row.nonCashSales) }}</span>
          </template>

          <template #cell-expectedCash="{ row }">
            <span class="amount font-semibold">{{ formatCurrency(row.expectedCash) }}</span>
          </template>

          <template #cell-countedCash="{ row }">
            <span class="amount">
              {{ row.shift.countedCash === null ? EMPTY : formatCurrency(row.shift.countedCash) }}
            </span>
          </template>

          <template #cell-difference="{ row }">
            <span class="amount font-semibold" :class="differenceClass(row.cashDifference)">
              {{ row.shift.countedCash === null ? EMPTY : differenceText(row.cashDifference) }}
            </span>
          </template>

          <template #cell-deposited="{ row }">
            <span class="amount">
              {{ row.shift.depositedAmount > 0 ? formatCurrency(row.shift.depositedAmount) : EMPTY }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.shift.status" />
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState
                title="Belum ada shift kasir"
                description="Ubah filter periode di topbar, atau buka shift baru dari terminal POS."
              />
            </div>
          </template>
        </BaseTable>
      </BaseCard>

      <IntegrationNote title="Shift adalah pertanggungjawaban uang fisik">
        Saldo akun <strong>1130 Kas Kasir</strong> di Neraca selalu sama dengan sisa laci menurut
        rekap shift di halaman ini — tidak ada uang konter yang tidak ada pemiliknya. Selisih hitung
        fisik langsung masuk Laba Rugi lewat akun <strong>7200 Selisih Kas</strong>, setoran ke bank
        menambah akun <strong>1110 Bank BCA</strong>, sedangkan dana QRIS dan debit baru menjadi kas
        setelah dicairkan penyelenggara — sampai saat itu ia mengendap di akun <strong>1250</strong>.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="reportOpen"
      title="Laporan Tutup Kasir (Z-Report)"
      description="Rincian aritmetika kas satu shift, dari modal awal sampai sisa di laci."
      @close="closeReport"
    >
      <div v-if="selected" class="flex flex-col gap-5">
        <!-- Kop laporan -->
        <dl class="grid grid-cols-2 gap-y-1 rounded-card border border-line bg-surface-alt/60 px-4 py-3 text-xs">
          <dt class="text-ink-secondary">No. Shift</dt>
          <dd class="identifier text-right">{{ selected.shift.number }}</dd>

          <dt class="text-ink-secondary">Tanggal</dt>
          <dd class="text-right text-ink-primary">{{ formatDate(selected.shift.date) }}</dd>

          <dt class="text-ink-secondary">Kasir</dt>
          <dd class="text-right text-ink-primary">{{ selected.shift.cashierName }}</dd>

          <dt class="text-ink-secondary">Gudang</dt>
          <dd class="text-right text-ink-primary">{{ selected.warehouseName }}</dd>

          <dt class="text-ink-secondary">Jam</dt>
          <dd class="amount text-right text-ink-primary">
            {{ selected.shift.openedAt }} s/d {{ selected.shift.closedAt ?? 'masih buka' }}
          </dd>

          <dt class="text-ink-secondary">Status</dt>
          <dd class="text-right">
            <BaseBadge :status="selected.shift.status" />
          </dd>
        </dl>

        <!-- Aritmetika kas: dibuat berjenjang supaya angka akhirnya bisa dilacak. -->
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Perhitungan kas laci
          </p>

          <dl class="flex flex-col gap-1 rounded-card border border-line px-4 py-3 text-data">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Modal kas awal</dt>
              <dd class="amount text-ink-primary">
                {{ formatCurrency(selected.shift.openingFloat) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">+ Penjualan tunai</dt>
              <dd class="amount text-ink-primary">{{ formatCurrency(selected.cashSales) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">− Pembelian barang bekas (tunai)</dt>
              <dd class="amount text-ink-primary">{{ formatCurrency(selected.cashPurchases) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-t border-line pt-1">
              <dt class="font-semibold text-ink-primary">= Kas seharusnya</dt>
              <dd class="amount font-semibold text-ink-primary">
                {{ formatCurrency(selected.expectedCash) }}
              </dd>
            </div>

            <div class="mt-2 flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2">
              <dt class="text-ink-secondary">Hitung fisik</dt>
              <dd class="amount text-ink-primary">
                {{
                  selected.shift.countedCash === null
                    ? 'Belum dihitung'
                    : formatCurrency(selected.shift.countedCash)
                }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Selisih kas</dt>
              <dd class="amount font-semibold" :class="differenceClass(selected.cashDifference)">
                {{
                  selected.shift.countedCash === null
                    ? EMPTY
                    : differenceText(selected.cashDifference)
                }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Setoran ke bank</dt>
              <dd class="amount text-ink-primary">
                {{ formatCurrency(selected.shift.depositedAmount) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-t border-line pt-1">
              <dt class="font-semibold text-ink-primary">Sisa di laci</dt>
              <dd class="amount font-semibold text-ink-primary">
                {{ cashLeftInDrawer === null ? EMPTY : formatCurrency(cashLeftInDrawer) }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Ringkasan penjualan | konteks di balik angka kas di atas. -->
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Ringkasan penjualan
          </p>

          <dl class="flex flex-col gap-1 rounded-card border border-line px-4 py-3 text-data">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Penjualan kotor ({{ formatNumber(selected.transactionCount) }} transaksi)</dt>
              <dd class="amount text-ink-primary">{{ formatCurrency(selected.grossSales) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Potongan tukar tambah</dt>
              <dd class="amount text-ink-primary">
                {{ selected.tradeInValue > 0 ? `−${formatCurrency(selected.tradeInValue)}` : EMPTY }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Penerimaan non-tunai (QRIS & debit)</dt>
              <dd class="amount text-ink-primary">{{ formatCurrency(selected.nonCashSales) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Biaya MDR</dt>
              <dd class="amount text-ink-primary">{{ formatCurrency(selected.mdrFee) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">PPN keluaran shift ini</dt>
              <dd class="amount text-ink-primary">{{ formatCurrency(selected.outputVat) }}</dd>
            </div>
          </dl>
        </div>

        <p class="rounded-control border border-line bg-surface-alt px-3 py-2 text-xs text-ink-secondary">
          Selisih kas tidak bisa didiamkan: sistem menjurnalnya otomatis ke akun
          <span class="identifier">7200</span> Selisih Kas, sehingga laci yang bocor terbaca di Laba
          Rugi. Setoran ke bank memindahkan uang dari <span class="identifier">1130</span> Kas Kasir
          ke <span class="identifier">1110</span> Bank BCA | sisanya tetap di laci sebagai modal
          shift berikutnya.
        </p>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="closeReport">Tutup</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
