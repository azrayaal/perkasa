<script setup lang="ts">
/**
 * Riwayat transaksi kasir | daftar struk yang sudah terbit pada periode aktif.
 *
 * Halaman ini murni pembacaan: struk kasir tidak punya tahap draft dan tidak
 * bisa dikoreksi dari sini. Yang penting justru penelusurannya | satu klik pada
 * baris membuka struk beserta jurnal yang lahir darinya, sehingga angka di
 * layar kasir bisa dipertanggungjawabkan sampai ke buku besar.
 */
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import JournalEntryList from '@/components/erp/JournalEntryList.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { getProducts } from '@/services/masterService'
import { getPosReceipt, getPosTransactions, MDR_RATE, METHOD_LABEL } from '@/services/posService'
import type { PosReceipt } from '@/services/posService'
import { usePeriodStore } from '@/stores/periodStore'
import { useToastStore } from '@/stores/toastStore'
import { lineAmount } from '@/utils/documentTotals'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { DocumentLine, PosPaymentMethod, PosTransaction, PosTransactionType, Product } from '@/types'
import { EMPTY } from '@/utils/placeholder'

const period = usePeriodStore()
const toast = useToastStore()

const rows = ref<PosTransaction[]>([])
const products = ref<Product[]>([])
const loading = ref(true)

/* Filter tabel */
const search = ref('')
const methodFilter = ref<PosPaymentMethod | 'all'>('all')
const typeFilter = ref<PosTransactionType | 'all'>('all')

const METHOD_OPTIONS: Array<{ value: PosPaymentMethod | 'all'; label: string }> = [
  { value: 'all', label: 'Semua metode' },
  { value: 'tunai', label: METHOD_LABEL.tunai },
  { value: 'qris', label: METHOD_LABEL.qris },
  { value: 'debit', label: METHOD_LABEL.debit },
]

const TYPE_OPTIONS: Array<{ value: PosTransactionType | 'all'; label: string }> = [
  { value: 'all', label: 'Semua jenis' },
  { value: 'sale', label: 'Penjualan' },
  { value: 'buy', label: 'Pembelian barang bekas' },
]

async function load(): Promise<void> {
  loading.value = true

  const [transactionList, productList] = await Promise.all([
    getPosTransactions(period.from, period.to),
    getProducts(),
  ])

  rows.value = transactionList
  products.value = productList
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

/** Nama produk untuk baris struk | struk tanpa nama barang tidak bisa dibaca pembeli. */
function productNameOf(productId: string): string {
  return products.value.find((product) => product.id === productId)?.name ?? productId
}

function productUnitOf(productId: string): string {
  return products.value.find((product) => product.id === productId)?.unit ?? ''
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return rows.value.filter((row) => {
    if (methodFilter.value !== 'all' && row.method !== methodFilter.value) return false
    if (typeFilter.value !== 'all' && row.type !== typeFilter.value) return false
    if (!term) return true
    return (
      row.number.toLowerCase().includes(term) ||
      row.customerName.toLowerCase().includes(term) ||
      row.cashierName.toLowerCase().includes(term)
    )
  })
})

const summary = computed(() => {
  const sales = rows.value.filter((row) => row.type === 'sale')
  const revenue = sales.reduce((sum, row) => sum + row.totals.total, 0)

  return {
    revenue,
    count: rows.value.length,
    average: sales.length === 0 ? 0 : Math.round(revenue / sales.length),
    scrapPurchase: rows.value
      .filter((row) => row.type === 'buy')
      .reduce((sum, row) => sum + row.totals.total, 0),
  }
})

const columns: TableColumn<PosTransaction>[] = [
  { key: 'number', label: 'No. Struk' },
  { key: 'datetime', label: 'Tanggal & Jam' },
  { key: 'customer', label: 'Pembeli' },
  { key: 'method', label: 'Metode' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'tradeIn', label: 'Potongan Tukar Tambah', align: 'right' },
  { key: 'netDue', label: 'Yang Dibayar', align: 'right' },
]

/* -------------------------------------------------------------------------- */
/* Struk                                                                       */
/* -------------------------------------------------------------------------- */

const receiptOpen = ref(false)
const receiptLoading = ref(false)
const receipt = ref<PosReceipt | null>(null)

async function openReceipt(row: PosTransaction): Promise<void> {
  receiptOpen.value = true
  receiptLoading.value = true
  receipt.value = null

  try {
    receipt.value = await getPosReceipt(row.id)
  } catch (caught) {
    receiptOpen.value = false
    toast.push(caught instanceof Error ? caught.message : 'Struk tidak ditemukan.', 'error')
  } finally {
    receiptLoading.value = false
  }
}

function closeReceipt(): void {
  receiptOpen.value = false
  receipt.value = null
}

/** Nilai satu baris struk setelah diskon | rumusnya milik util dokumen, bukan view. */
function amountOf(line: DocumentLine): number {
  return lineAmount(line)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Riwayat Transaksi Kasir"
      :description="`Struk konter periode ${period.label}. Transaksi kasir selesai saat itu juga — tidak ada draft, jurnalnya langsung terbentuk.`"
    />

    <LoadingState v-if="loading" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Omzet Kasir"
          :value="formatCurrency(summary.revenue)"
          icon="pos"
          tone="brand"
          caption="Penjualan konter termasuk PPN"
        />
        <StatCard
          label="Jumlah Transaksi"
          :value="formatNumber(summary.count)"
          icon="receipt"
          caption="Struk terbit pada periode ini"
        />
        <StatCard
          label="Rata-rata per Transaksi"
          :value="formatCurrency(summary.average)"
          icon="performance"
          caption="Omzet dibagi jumlah struk penjualan"
        />
        <StatCard
          label="Pembelian Barang Bekas"
          :value="formatCurrency(summary.scrapPurchase)"
          icon="cash"
          caption="Uang tunai keluar dari laci konter"
        />
      </div>

      <BaseCard flush>
        <template #header>
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <label class="relative flex min-w-0 flex-1 items-center">
              <span class="sr-only">Cari struk</span>
              <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
              <input
                v-model="search"
                type="search"
                placeholder="Cari nomor struk, pembeli, atau kasir…"
                class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <select
              v-model="methodFilter"
              class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="option in METHOD_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>

            <select
              v-model="typeFilter"
              class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="option in TYPE_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </template>

        <BaseTable
          :columns="columns"
          :rows="filtered"
          :row-key="(row) => row.id"
          clickable
          @row-click="openReceipt"
        >
          <template #cell-number="{ row }">
            <span class="identifier">{{ row.number }}</span>
            <span
              v-if="row.tradeIn"
              class="ml-2 rounded-full bg-brand/25 px-2 py-0.5 text-[11px] font-semibold text-ink-primary"
              title="Pembeli menyerahkan barang bekas sebagai potongan pembayaran"
            >
              Tukar tambah
            </span>
            <span v-if="row.type === 'buy'" class="block text-xs text-ink-muted">
              Pembelian barang bekas di konter
            </span>
          </template>

          <template #cell-datetime="{ row }">
            <span class="text-ink-primary">{{ formatDate(row.date) }}</span>
            <span class="amount block text-xs text-ink-muted">{{ row.time }}</span>
          </template>

          <template #cell-customer="{ row }">
            <span class="font-medium text-ink-primary">{{ row.customerName }}</span>
            <span class="block text-xs text-ink-muted">Kasir {{ row.cashierName }}</span>
          </template>

          <template #cell-method="{ row }">
            <BaseBadge :status="row.method" />
          </template>

          <template #cell-total="{ row }">
            <span class="amount">{{ formatCurrency(row.totals.total) }}</span>
          </template>

          <template #cell-tradeIn="{ row }">
            <span class="amount" :class="row.tradeIn ? 'text-state-warning' : 'text-ink-muted'">
              {{ row.tradeIn ? `−${formatCurrency(row.tradeIn.total)}` : EMPTY }}
            </span>
          </template>

          <template #cell-netDue="{ row }">
            <span class="amount font-semibold">{{ formatCurrency(row.netDue) }}</span>
            <span v-if="row.mdrFee > 0" class="block text-xs text-ink-muted">
              MDR {{ formatCurrency(row.mdrFee) }}
            </span>
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState
                title="Belum ada transaksi kasir"
                description="Ubah filter periode di topbar, atau catat transaksi baru dari terminal POS."
              />
            </div>
          </template>
        </BaseTable>
      </BaseCard>

      <IntegrationNote title="Struk kasir bukan catatan terpisah">
        Setiap struk yang terbit di halaman ini langsung membentuk <strong>jurnal</strong> di
        pembukuan, mengurangi <strong>stok gudang</strong> tempat konter itu berada, dan PPN
        keluarannya ikut ke <strong>SPT Masa PPN</strong> yang sama dengan faktur penjualan
        bertermin. Karena itu omzet kasir {{ formatCurrency(summary.revenue) }} tidak perlu
        dijumlahkan manual ke laporan — ia sudah berada di akun <strong>4100</strong>.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="receiptOpen"
      title="Struk Kasir"
      description="Tampilan struk seperti yang diterima pembeli, lengkap dengan jurnal yang lahir darinya."
      @close="closeReceipt"
    >
      <LoadingState v-if="receiptLoading" :rows="6" />

      <div v-else-if="receipt" class="flex flex-col gap-5">
        <!-- Struk | kop, rincian barang, dan penyelesaian pembayaran. -->
        <div class="rounded-card border border-line bg-surface-alt/60 px-4 py-4">
          <div class="text-center">
            <p class="text-h4 text-ink-primary">Perkasa ERP</p>
            <p class="text-xs text-ink-secondary">Struk penjualan konter</p>
          </div>

          <dl class="mt-3 grid grid-cols-2 gap-y-1 border-t border-dashed border-line pt-3 text-xs">
            <dt class="text-ink-secondary">No. Struk</dt>
            <dd class="identifier text-right">{{ receipt.transaction.number }}</dd>

            <dt class="text-ink-secondary">Tanggal</dt>
            <dd class="text-right text-ink-primary">
              {{ formatDate(receipt.transaction.date) }} · {{ receipt.transaction.time }}
            </dd>

            <dt class="text-ink-secondary">Kasir</dt>
            <dd class="text-right text-ink-primary">{{ receipt.transaction.cashierName }}</dd>

            <dt class="text-ink-secondary">Gudang</dt>
            <dd class="text-right text-ink-primary">{{ receipt.warehouseName }}</dd>

            <dt class="text-ink-secondary">Pembeli</dt>
            <dd class="text-right text-ink-primary">{{ receipt.transaction.customerName }}</dd>
          </dl>

          <ul class="mt-3 flex flex-col gap-2 border-t border-dashed border-line pt-3">
            <li v-for="(line, index) in receipt.transaction.lines" :key="`${line.productId}-${index}`">
              <p class="text-data text-ink-primary">{{ productNameOf(line.productId) }}</p>
              <div class="flex items-baseline justify-between gap-3 text-xs">
                <span class="amount text-ink-secondary">
                  {{ formatNumber(line.qty) }} {{ productUnitOf(line.productId) }} ×
                  {{ formatCurrency(line.unitPrice) }}
                  <span v-if="line.discountPercent > 0">| diskon {{ line.discountPercent }}%</span>
                </span>
                <span class="amount text-ink-primary">{{ formatCurrency(amountOf(line)) }}</span>
              </div>
            </li>
          </ul>

          <dl class="mt-3 flex flex-col gap-1 border-t border-dashed border-line pt-3 text-data">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">Subtotal (DPP)</dt>
              <dd class="amount text-ink-primary">
                {{ formatCurrency(receipt.transaction.totals.dpp) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-secondary">PPN</dt>
              <dd class="amount text-ink-primary">
                {{ formatCurrency(receipt.transaction.totals.ppn) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-t border-line pt-1">
              <dt class="font-semibold text-ink-primary">Total</dt>
              <dd class="amount font-semibold text-ink-primary">
                {{ formatCurrency(receipt.transaction.totals.total) }}
              </dd>
            </div>
          </dl>

          <!-- Tukar tambah: bukan diskon, melainkan barang bekas yang diterima. -->
          <div
            v-if="receipt.transaction.tradeIn"
            class="mt-3 rounded-control border border-line bg-surface px-3 py-2"
          >
            <p class="text-xs font-semibold text-ink-primary">Tukar tambah barang bekas</p>
            <ul class="mt-1 flex flex-col gap-1">
              <li
                v-for="(line, index) in receipt.transaction.tradeIn.lines"
                :key="`trade-${line.productId}-${index}`"
                class="flex items-baseline justify-between gap-3 text-xs"
              >
                <span class="text-ink-secondary">
                  {{ productNameOf(line.productId) }} ·
                  <span class="amount">{{ formatNumber(line.qty) }}</span>
                  {{ productUnitOf(line.productId) }}
                </span>
                <span class="amount text-ink-primary">
                  {{ formatCurrency(line.qty * line.unitValue) }}
                </span>
              </li>
            </ul>
            <div class="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-1 text-xs">
              <span class="text-ink-secondary">Nilai tukar tambah (termasuk PPN)</span>
              <span class="amount font-semibold text-state-warning">
                −{{ formatCurrency(receipt.transaction.tradeIn.total) }}
              </span>
            </div>
          </div>

          <dl class="mt-3 flex flex-col gap-1 border-t border-dashed border-line pt-3 text-data">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="font-semibold text-ink-primary">Yang dibayar</dt>
              <dd class="amount font-semibold text-ink-primary">
                {{ formatCurrency(receipt.transaction.netDue) }}
              </dd>
            </div>

            <template v-if="receipt.transaction.method === 'tunai'">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-secondary">Tunai diterima</dt>
                <dd class="amount text-ink-primary">
                  {{ formatCurrency(receipt.transaction.cashTendered) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-secondary">Kembalian</dt>
                <dd class="amount text-ink-primary">
                  {{ formatCurrency(receipt.transaction.change) }}
                </dd>
              </div>
            </template>

            <template v-else>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-secondary">Metode pembayaran</dt>
                <dd class="text-right text-ink-primary">
                  {{ METHOD_LABEL[receipt.transaction.method] }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-secondary">
                  Biaya MDR ({{ formatPercent(MDR_RATE[receipt.transaction.method]) }})
                </dt>
                <dd class="amount text-ink-primary">
                  {{ formatCurrency(receipt.transaction.mdrFee) }}
                </dd>
              </div>
              <p class="text-xs text-ink-muted">
                Dana non-tunai belum menjadi kas — masih mengendap di penyelenggara pembayaran
                sampai dicairkan ke rekening bank.
              </p>
            </template>
          </dl>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Jurnal otomatis dari struk ini
          </p>
          <JournalEntryList :entries="receipt.journal" compact />
        </div>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="closeReceipt">Tutup</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
