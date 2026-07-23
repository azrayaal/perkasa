<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TabItem } from '@/components/ui/BaseTabs.types'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { today } from '@/services/clock'
import {
  createStockAdjustment,
  getStockCard,
  getStockPositions,
  getWarehouseSummaries,
} from '@/services/inventoryService'
import { getWarehouses } from '@/services/masterService'
import { usePeriodStore } from '@/stores/periodStore'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency, formatCurrencyShort, formatNumber } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { StockCardRow, StockMoveType, StockPosition, WarehouseSummary, Warehouse } from '@/types'
import { EMPTY } from '@/utils/placeholder'

const period = usePeriodStore()
const toast = useToastStore()

const positions = ref<StockPosition[]>([])
const summaries = ref<WarehouseSummary[]>([])
const warehouses = ref<Warehouse[]>([])
const loading = ref(true)

/**
 * Posisi stok selalu dilihat per akhir periode aktif | supaya nilainya bisa
 * dibandingkan langsung dengan saldo akun 1300 pada Neraca tanggal yang sama.
 */
async function load(): Promise<void> {
  loading.value = true

  const [positionList, summaryList, warehouseList] = await Promise.all([
    getStockPositions(period.to),
    getWarehouseSummaries(period.to),
    getWarehouses(),
  ])

  positions.value = positionList
  summaries.value = summaryList
  warehouses.value = warehouseList

  if (!cardProductId.value) cardProductId.value = positionList[0]?.product.id ?? ''

  loading.value = false
  await loadCard()
}

watch(() => [period.from, period.to], load, { immediate: true })

const summary = computed(() => ({
  value: positions.value.reduce((sum, position) => sum + position.value, 0),
  skuCount: positions.value.length,
  restockCount: positions.value.filter((position) => position.status !== 'in-stock').length,
  warehouseCount: summaries.value.length,
}))

/* -------------------------------------------------------------------------- */
/* Tab                                                                         */
/* -------------------------------------------------------------------------- */

const activeTab = ref<string>('positions')

const tabs = computed<TabItem[]>(() => [
  { key: 'positions', label: 'Posisi Stok', count: positions.value.length },
  { key: 'card', label: 'Kartu Stok', count: cardRows.value.length },
])

/* -------------------------------------------------------------------------- */
/* Tab posisi stok                                                             */
/* -------------------------------------------------------------------------- */

const search = ref('')
const warehouseFilter = ref<string>('all')

const filteredPositions = computed(() => {
  const term = search.value.trim().toLowerCase()

  return positions.value.filter((position) => {
    if (warehouseFilter.value !== 'all') {
      const qty =
        position.byWarehouse.find((row) => row.warehouse.id === warehouseFilter.value)?.qty ?? 0
      if (qty === 0) return false
    }
    if (!term) return true
    return (
      position.product.name.toLowerCase().includes(term) ||
      position.product.sku.toLowerCase().includes(term)
    )
  })
})

const positionColumns: TableColumn<StockPosition>[] = [
  { key: 'product', label: 'Produk' },
  { key: 'category', label: 'Kategori', value: (position) => position.product.category },
  { key: 'onHand', label: 'Stok', align: 'right' },
  { key: 'byWarehouse', label: 'Per Gudang' },
  { key: 'value', label: 'Nilai Persediaan', align: 'right' },
  { key: 'avgOut', label: 'Rata-rata Keluar/Bln', align: 'right' },
  { key: 'cover', label: 'Hari Tersisa', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
]

/** Klik baris = lanjut menelusuri produk itu di kartu stok. */
function inspect(position: StockPosition): void {
  cardProductId.value = position.product.id
  activeTab.value = 'card'
  void loadCard()
}

/* -------------------------------------------------------------------------- */
/* Tab kartu stok                                                              */
/* -------------------------------------------------------------------------- */

const cardProductId = ref('')
const cardWarehouseId = ref<string>('all')
const cardRows = ref<StockCardRow[]>([])
const cardLoading = ref(false)

async function loadCard(): Promise<void> {
  if (!cardProductId.value) {
    cardRows.value = []
    return
  }

  cardLoading.value = true
  cardRows.value = await getStockCard(
    cardProductId.value,
    cardWarehouseId.value === 'all' ? null : cardWarehouseId.value,
  )
  cardLoading.value = false
}

watch([cardProductId, cardWarehouseId], loadCard)

const MOVE_LABEL: Record<StockMoveType, string> = {
  in: 'Masuk',
  out: 'Keluar',
  adjustment: 'Penyesuaian',
}

const MOVE_CLASS: Record<StockMoveType, string> = {
  in: 'text-state-success',
  out: 'text-state-error',
  adjustment: 'text-state-warning',
}

/* -------------------------------------------------------------------------- */
/* Stock opname                                                                */
/* -------------------------------------------------------------------------- */

const opnameOpen = ref(false)
const saving = ref(false)

const opnameForm = ref({
  date: today(),
  productId: '',
  warehouseId: '',
  qtyDiff: 0,
  reason: '',
})

function openOpname(): void {
  opnameForm.value = {
    date: today(),
    productId: cardProductId.value || (positions.value[0]?.product.id ?? ''),
    warehouseId: warehouses.value[0]?.id ?? '',
    qtyDiff: 0,
    reason: '',
  }
  opnameOpen.value = true
}

async function submitOpname(): Promise<void> {
  saving.value = true

  try {
    const created = await createStockAdjustment({
      date: opnameForm.value.date,
      productId: opnameForm.value.productId,
      warehouseId: opnameForm.value.warehouseId,
      qtyDiff: opnameForm.value.qtyDiff,
      reason: opnameForm.value.reason,
    })

    opnameOpen.value = false
    toast.push(`Opname ${created.number} tercatat — selisihnya langsung dijurnal.`)
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menyimpan opname.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Gudang & Persediaan"
      :description="`Posisi stok per ${formatDate(period.to)}. Kartu stok dirakit ulang dari dokumen pembelian dan penjualan, bukan diketik.`"
    >
      <template #actions>
        <BaseButton icon="check" @click="openOpname">Stock Opname</BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" :rows="6" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Nilai Persediaan"
          :value="formatCurrency(summary.value)"
          icon="warehouse"
          tone="brand"
          caption="Setara saldo akun 1300"
        />
        <StatCard
          label="Total SKU"
          :value="formatNumber(summary.skuCount)"
          icon="master"
          caption="Produk terdaftar di master"
        />
        <StatCard
          label="Perlu Restock"
          :value="formatNumber(summary.restockCount)"
          icon="alert"
          :tone="summary.restockCount > 0 ? 'warning' : 'plain'"
          caption="Di bawah stok minimum atau habis"
        />
        <StatCard
          label="Gudang Aktif"
          :value="formatNumber(summary.warehouseCount)"
          icon="building"
          caption="Lokasi penyimpanan"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <BaseCard v-for="item in summaries" :key="item.warehouse.id">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-h4 text-ink-primary">{{ item.warehouse.name }}</p>
              <p class="text-small text-ink-secondary">{{ item.warehouse.city }}</p>
            </div>
            <span class="identifier shrink-0">{{ item.warehouse.code }}</span>
          </div>

          <dl class="mt-4 grid grid-cols-3 gap-2 text-data">
            <div>
              <dt class="text-xs text-ink-secondary">SKU</dt>
              <dd class="amount font-semibold">{{ formatNumber(item.skuCount) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-ink-secondary">Unit</dt>
              <dd class="amount font-semibold">{{ formatNumber(item.units) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-ink-secondary">Nilai</dt>
              <dd class="amount font-semibold">{{ formatCurrencyShort(item.value) }}</dd>
            </div>
          </dl>

          <div class="mt-4">
            <div class="flex items-center justify-between text-xs">
              <span class="text-ink-secondary">Utilisasi kapasitas</span>
              <span class="amount font-semibold" :class="item.utilization > 90 ? 'text-state-warning' : 'text-ink-primary'">
                {{ item.utilization }}%
              </span>
            </div>
            <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
              <div
                class="h-full rounded-full"
                :class="item.utilization > 90 ? 'bg-state-warning' : 'bg-brand'"
                :style="{ width: `${Math.min(item.utilization, 100)}%` }"
              />
            </div>
          </div>
        </BaseCard>
      </div>

      <BaseCard flush>
        <template #header>
          <BaseTabs v-model="activeTab" :tabs="tabs" class="w-full" />
        </template>

        <template v-if="activeTab === 'positions'">
          <div class="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center">
            <label class="relative flex min-w-0 flex-1 items-center">
              <span class="sr-only">Cari produk</span>
              <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
              <input
                v-model="search"
                type="search"
                placeholder="Cari nama produk atau SKU…"
                class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <select
              v-model="warehouseFilter"
              class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="all">Semua gudang</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
          </div>

          <BaseTable
            :columns="positionColumns"
            :rows="filteredPositions"
            :row-key="(position) => position.product.id"
            clickable
            @row-click="inspect"
          >
            <template #cell-product="{ row }">
              <span class="font-medium text-ink-primary">{{ row.product.name }}</span>
              <span class="identifier block">{{ row.product.sku }}</span>
            </template>

            <template #cell-onHand="{ row }">
              <span class="amount font-semibold">{{ formatNumber(row.onHand) }}</span>
              <span class="block text-xs text-ink-muted">{{ row.product.unit }}</span>
            </template>

            <!-- Rincian per gudang ditulis ringkas: kode gudang + qty, hanya yang berisi. -->
            <template #cell-byWarehouse="{ row }">
              <span
                v-for="entry in row.byWarehouse.filter((item) => item.qty !== 0)"
                :key="entry.warehouse.id"
                class="block text-xs text-ink-secondary"
              >
                <span class="identifier">{{ entry.warehouse.code }}</span>
                <span class="amount ml-1">{{ formatNumber(entry.qty) }}</span>
              </span>
              <span v-if="row.onHand === 0" class="text-xs text-ink-muted">Kosong di semua gudang</span>
            </template>

            <template #cell-value="{ row }">
              <span class="amount">{{ formatCurrency(row.value) }}</span>
            </template>

            <template #cell-avgOut="{ row }">
              <span class="amount">{{ formatNumber(row.avgMonthlyOut) }}</span>
            </template>

            <template #cell-cover="{ row }">
              <span class="amount" :class="row.daysOfCover !== null && row.daysOfCover < 30 ? 'text-state-warning' : ''">
                {{ row.daysOfCover === null ? EMPTY : `${row.daysOfCover} hari` }}
              </span>
            </template>

            <template #cell-status="{ row }">
              <BaseBadge :status="row.status" />
            </template>

            <template #empty>
              <div class="px-4 pb-4">
                <EmptyState
                  title="Tidak ada produk yang cocok"
                  description="Ubah kata kunci pencarian atau pilihan gudang."
                />
              </div>
            </template>
          </BaseTable>
        </template>

        <template v-else>
          <div class="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center">
            <label class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="sr-only">Produk</span>
              <select
                v-model="cardProductId"
                class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option v-for="position in positions" :key="position.product.id" :value="position.product.id">
                  {{ position.product.sku }} — {{ position.product.name }}
                </option>
              </select>
            </label>

            <select
              v-model="cardWarehouseId"
              class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="all">Semua gudang</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
          </div>

          <LoadingState v-if="cardLoading" :rows="4" />

          <div v-else-if="cardRows.length === 0" class="px-4 pb-4">
            <EmptyState
              title="Belum ada mutasi"
              description="Produk ini belum pernah masuk atau keluar pada gudang terpilih."
            />
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse text-data">
              <thead>
                <tr class="border-b border-line">
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Tanggal</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Mutasi</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Dokumen</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Gudang</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Qty</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in cardRows" :key="row.move.id" class="border-b border-line/70 last:border-b-0">
                  <td class="px-4 py-3 text-ink-primary">{{ formatDate(row.move.date) }}</td>
                  <td class="px-4 py-3">
                    <span class="font-semibold" :class="MOVE_CLASS[row.move.type]">
                      {{ MOVE_LABEL[row.move.type] }}
                    </span>
                    <span class="block text-xs text-ink-muted">{{ row.move.note }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="identifier">{{ row.move.refNumber ?? 'Saldo awal' }}</span>
                  </td>
                  <td class="px-4 py-3 text-ink-primary">{{ row.warehouseName }}</td>
                  <td class="amount px-4 py-3 text-right font-semibold" :class="MOVE_CLASS[row.move.type]">
                    {{ row.move.qty > 0 ? `+${formatNumber(row.move.qty)}` : formatNumber(row.move.qty) }}
                  </td>
                  <td class="amount px-4 py-3 text-right font-semibold text-ink-primary">
                    {{ formatNumber(row.balance) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </BaseCard>

      <IntegrationNote title="Gudang tidak punya angka sendiri">
        Kartu stok di halaman ini bukan tabel terpisah: ia dirakit ulang dari saldo awal, faktur
        <strong>pembelian</strong> (barang masuk), dan faktur <strong>penjualan</strong> yang sudah
        diposting (barang keluar). Karena sumbernya sama, nilai persediaan
        {{ formatCurrency(summary.value) }} selalu sama dengan saldo akun <strong>1300</strong> di
        Neraca. Selisih hasil stock opname pun tidak bisa lolos diam-diam — sistem langsung
        membentuk jurnal ke akun <strong>5200 Selisih Persediaan</strong>.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="opnameOpen"
      title="Stock Opname"
      description="Catat selisih antara stok fisik dan stok sistem."
      @close="opnameOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitOpname">
        <BaseInput v-model="opnameForm.date" label="Tanggal opname" type="date" required />

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">
            Produk <span class="text-state-error">*</span>
          </span>
          <select
            v-model="opnameForm.productId"
            required
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="position in positions" :key="position.product.id" :value="position.product.id">
              {{ position.product.sku }} — {{ position.product.name }}
            </option>
          </select>
        </label>

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">
            Gudang <span class="text-state-error">*</span>
          </span>
          <select
            v-model="opnameForm.warehouseId"
            required
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }} — {{ warehouse.city }}
            </option>
          </select>
        </label>

        <BaseInput
          v-model.number="opnameForm.qtyDiff"
          label="Selisih kuantitas"
          type="number"
          required
          hint="Positif bila stok fisik lebih banyak, negatif bila susut."
        />

        <BaseInput
          v-model="opnameForm.reason"
          label="Alasan"
          placeholder="Mis. susut karena karat, salah hitung penerimaan"
          required
        />

        <p class="rounded-control border border-line bg-surface-alt px-3 py-2 text-xs text-ink-secondary">
          Selisih ini otomatis dijurnal: akun <span class="identifier">5200</span> Selisih Persediaan
          berlawanan dengan <span class="identifier">1300</span> Persediaan. Susut menjadi debit di
          5200, kelebihan menjadi kredit — tidak ada koreksi stok tanpa jejak akuntansi.
        </p>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="opnameOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="opnameForm.qtyDiff === 0" @click="submitOpname">
          Simpan Opname
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
