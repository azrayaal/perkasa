<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DocumentLineEditor from '@/components/erp/DocumentLineEditor.vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import TradeInEditor from '@/components/erp/TradeInEditor.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { today } from '@/services/clock'
import { getCompanyProfile, getCustomers, getProducts, getWarehouses } from '@/services/masterService'
import { createSalesInvoice, getSalesRows, postSalesInvoice } from '@/services/salesService'
import { ROUTE } from '@/router/routeNames'
import { usePeriodStore } from '@/stores/periodStore'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { calcTotals } from '@/utils/documentTotals'
import type {
  Customer,
  DocumentLine,
  DocumentStatus,
  Product,
  SalesRow,
  TradeInLine,
  Warehouse,
} from '@/types'
import { EMPTY } from '@/utils/placeholder'

const router = useRouter()
const toast = useToastStore()
const period = usePeriodStore()

const rows = ref<SalesRow[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)

/* Filter tabel */
const search = ref('')
const statusFilter = ref<DocumentStatus | 'all'>('all')

const STATUS_OPTIONS: Array<{ value: DocumentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Terposting' },
  { value: 'partial', label: 'Dibayar sebagian' },
  { value: 'paid', label: 'Lunas' },
  { value: 'overdue', label: 'Jatuh tempo' },
]

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getSalesRows(period.from, period.to)
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return rows.value.filter((row) => {
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
    if (!term) return true
    return (
      row.invoice.number.toLowerCase().includes(term) ||
      row.customerName.toLowerCase().includes(term) ||
      row.invoice.salesPerson.toLowerCase().includes(term)
    )
  })
})

const summary = computed(() => {
  const posted = rows.value.filter((row) => row.status !== 'draft')
  return {
    revenue: posted.reduce((sum, row) => sum + row.invoice.totals.dpp, 0),
    margin: posted.reduce((sum, row) => sum + row.margin, 0),
    outstanding: posted.reduce((sum, row) => sum + row.outstanding, 0),
    overdue: rows.value
      .filter((row) => row.status === 'overdue')
      .reduce((sum, row) => sum + row.outstanding, 0),
    draftCount: rows.value.filter((row) => row.status === 'draft').length,
  }
})

const columns: TableColumn<SalesRow>[] = [
  { key: 'number', label: 'No. Faktur' },
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.invoice.date) },
  { key: 'customer', label: 'Pelanggan', value: (row) => row.customerName },
  { key: 'dpp', label: 'DPP', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'outstanding', label: 'Sisa Tagihan', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

function openDetail(row: SalesRow): void {
  void router.push({ name: ROUTE.salesDetail, params: { id: row.invoice.id } })
}

/* -------------------------------------------------------------------------- */
/* Form faktur baru                                                            */
/* -------------------------------------------------------------------------- */

const formOpen = ref(false)
const saving = ref(false)

const customers = ref<Customer[]>([])
const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const vatRate = ref(11)

const form = ref({
  date: today(),
  customerId: '',
  warehouseId: '',
  salesPerson: 'Bayu Saputra',
  notes: '',
})

const formLines = ref<DocumentLine[]>([])

/* Tukar tambah: opsional, dimatikan secara default. */
const tradeInEnabled = ref(false)
const tradeInForm = ref<{ lines: TradeInLine[]; warehouseId: string; vatable: boolean }>({
  lines: [],
  warehouseId: '',
  vatable: true,
})

/** Barang yang dijual vs barang bekas yang diterima adalah dua daftar berbeda. */
const sellableProducts = computed(() =>
  products.value.filter((product) => product.category !== 'Barang Bekas'),
)
const scrapProducts = computed(() =>
  products.value.filter((product) => product.category === 'Barang Bekas'),
)

/** Total faktur berjalan | dipakai TradeInEditor menghitung sisa tagihan. */
const formInvoiceTotal = computed(() => calcTotals(formLines.value, vatRate.value).total)

async function openForm(): Promise<void> {
  formOpen.value = true

  if (customers.value.length === 0) {
    const [customerList, productList, warehouseList, company] = await Promise.all([
      getCustomers(),
      getProducts(),
      getWarehouses(),
      getCompanyProfile(),
    ])

    customers.value = customerList.filter((customer) => customer.status === 'active')
    products.value = productList
    warehouses.value = warehouseList
    vatRate.value = company.vatRate
  }

  form.value = {
    date: today(),
    customerId: customers.value[0]?.id ?? '',
    warehouseId: warehouses.value[0]?.id ?? '',
    salesPerson: 'Bayu Saputra',
    notes: '',
  }

  const firstProduct = sellableProducts.value[0]
  formLines.value = firstProduct
    ? [{ productId: firstProduct.id, qty: 50, unitPrice: firstProduct.price, discountPercent: 0 }]
    : []

  const firstScrap = scrapProducts.value[0]
  tradeInEnabled.value = false
  tradeInForm.value = {
    // Kuantitas awal sengaja kecil: nilai tukar tambah tidak boleh melebihi
    // total faktur, dan faktur baru biasanya masih berisi satu baris barang.
    lines: firstScrap ? [{ productId: firstScrap.id, qty: 100, unitValue: firstScrap.cost }] : [],
    warehouseId: warehouses.value[0]?.id ?? '',
    vatable: true,
  }
}

async function submitForm(): Promise<void> {
  saving.value = true

  try {
    const created = await createSalesInvoice({
      date: form.value.date,
      customerId: form.value.customerId,
      warehouseId: form.value.warehouseId,
      lines: formLines.value,
      salesPerson: form.value.salesPerson,
      notes: form.value.notes || undefined,
      tradeIn: tradeInEnabled.value ? tradeInForm.value : undefined,
    })

    formOpen.value = false
    toast.push(`Faktur ${created.number} tersimpan sebagai draft.`)
    await load()
    void router.push({ name: ROUTE.salesDetail, params: { id: created.id } })
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menyimpan faktur.', 'error')
  } finally {
    saving.value = false
  }
}

/** Posting langsung dari tabel | draft menjadi transaksi resmi. */
async function postInvoice(row: SalesRow): Promise<void> {
  busyId.value = row.invoice.id

  try {
    await postSalesInvoice(row.invoice.id)
    toast.push(`Faktur ${row.invoice.number} diposting: stok & jurnal ikut terbentuk.`)
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal memposting faktur.', 'error')
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Penjualan"
      :description="`Faktur penjualan periode ${period.label}. Faktur yang diposting langsung mengurangi stok dan membentuk jurnal.`"
    >
      <template #actions>
        <BaseButton icon="plus" @click="openForm">Faktur Baru</BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Penjualan (DPP)"
          :value="formatCurrency(summary.revenue)"
          icon="sales"
          tone="brand"
          :caption="`${rows.length} faktur`"
        />
        <StatCard
          label="Laba Kotor"
          :value="formatCurrency(summary.margin)"
          icon="performance"
          caption="Penjualan dikurangi harga pokok"
        />
        <StatCard
          label="Sisa Tagihan"
          :value="formatCurrency(summary.outstanding)"
          icon="users"
          caption="Belum diterima dari pelanggan"
        />
        <StatCard
          label="Jatuh Tempo"
          :value="formatCurrency(summary.overdue)"
          icon="alert"
          :tone="summary.overdue > 0 ? 'error' : 'plain'"
          :caption="`${summary.draftCount} faktur masih draft`"
        />
      </div>

      <BaseCard flush>
        <template #header>
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <label class="relative flex min-w-0 flex-1 items-center">
              <span class="sr-only">Cari faktur</span>
              <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
              <input
                v-model="search"
                type="search"
                placeholder="Cari nomor faktur, pelanggan, atau sales…"
                class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <select
              v-model="statusFilter"
              class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </template>

        <BaseTable
          :columns="columns"
          :rows="filtered"
          :row-key="(row) => row.invoice.id"
          clickable
          @row-click="openDetail"
        >
          <template #cell-number="{ row }">
            <span class="identifier">{{ row.invoice.number }}</span>
            <span
              v-if="row.tradeInValue > 0"
              class="ml-2 rounded-full bg-brand/25 px-2 py-0.5 text-[11px] font-semibold text-ink-primary"
              title="Faktur ini disertai tukar tambah barang bekas"
            >
              Tukar tambah
            </span>
            <span v-if="!row.invoice.taxInvoiceNumber && row.status !== 'draft'" class="block text-xs text-state-warning">
              Faktur pajak belum bernomor
            </span>
          </template>

          <template #cell-customer="{ row }">
            <span class="font-medium text-ink-primary">{{ row.customerName }}</span>
            <span class="block text-xs text-ink-muted">{{ row.warehouseName }}</span>
          </template>

          <template #cell-dpp="{ row }">
            <span class="amount">{{ formatCurrency(row.invoice.totals.dpp) }}</span>
          </template>

          <template #cell-total="{ row }">
            <span class="amount font-semibold">{{ formatCurrency(row.invoice.totals.total) }}</span>
          </template>

          <template #cell-outstanding="{ row }">
            <span class="amount" :class="row.status === 'overdue' ? 'text-state-error' : ''">
              {{ row.outstanding > 0 ? formatCurrency(row.outstanding) : EMPTY }}
            </span>
            <span v-if="row.tradeInValue > 0" class="block text-xs text-ink-muted">
              −{{ formatCurrency(row.tradeInValue) }} tukar tambah
            </span>
            <span v-if="row.overdueDays > 0" class="block text-xs text-state-error">
              {{ row.overdueDays }} hari
            </span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.status" />
          </template>

          <template #cell-actions="{ row }">
            <BaseButton
              v-if="row.status === 'draft'"
              size="sm"
              variant="secondary"
              icon="check"
              :loading="busyId === row.invoice.id"
              @click.stop="postInvoice(row)"
            >
              Posting
            </BaseButton>
            <BaseIcon v-else name="forward" :size="16" class="ml-auto text-ink-muted" />
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState
                title="Belum ada faktur penjualan"
                description="Ubah filter periode di topbar, atau buat faktur baru."
              />
            </div>
          </template>
        </BaseTable>
      </BaseCard>

      <IntegrationNote title="Satu faktur, lima modul bergerak">
        Faktur draft belum menyentuh apa pun. Begitu <strong>diposting</strong>: stok berkurang di
        <strong>Gudang</strong>, jurnal Piutang–Penjualan–PPN dan HPP–Persediaan terbentuk di
        <strong>Pembukuan</strong>, PPN keluaran masuk ke <strong>Perpajakan</strong>, piutang muncul
        di <strong>Neraca</strong>, dan labanya terbaca di <strong>Laporan Keuangan</strong>.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="formOpen"
      title="Faktur Penjualan Baru"
      description="Tersimpan sebagai draft — stok dan jurnal baru terbentuk setelah diposting."
      @close="formOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitForm">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.date" label="Tanggal faktur" type="date" required />

          <label class="flex w-full flex-col gap-2">
            <span class="text-sm font-medium text-ink-secondary">Pelanggan <span class="text-state-error">*</span></span>
            <select
              v-model="form.customerId"
              required
              class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                {{ customer.name }} · Net {{ customer.paymentTermDays }}
              </option>
            </select>
          </label>

          <label class="flex w-full flex-col gap-2">
            <span class="text-sm font-medium text-ink-secondary">Gudang pengirim <span class="text-state-error">*</span></span>
            <select
              v-model="form.warehouseId"
              required
              class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
          </label>

          <BaseInput v-model="form.salesPerson" label="Sales" required />
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-ink-secondary">Barang dijual</p>
          <DocumentLineEditor
            v-model="formLines"
            :products="sellableProducts"
            :vat-rate="vatRate"
            price-field="price"
          />
        </div>

        <div v-if="scrapProducts.length > 0" class="border-t border-line pt-4">
          <label class="flex items-start gap-2.5">
            <input
              v-model="tradeInEnabled"
              type="checkbox"
              class="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-ink-strong focus:ring-brand/30"
            />
            <span class="text-sm">
              <span class="font-semibold text-ink-primary">Tukar tambah besi bekas</span>
              <span class="block text-ink-secondary">
                Pelanggan menyerahkan barang bekas sebagai potongan pembayaran. Barangnya masuk
                gudang, dan tagihannya berkurang — bukan harga jualnya yang didiskon.
              </span>
            </span>
          </label>

          <div v-if="tradeInEnabled" class="mt-3">
            <TradeInEditor
              v-model="tradeInForm"
              :products="scrapProducts"
              :warehouses="warehouses"
              :vat-rate="vatRate"
              :invoice-total="formInvoiceTotal"
            />
          </div>
        </div>

        <BaseInput v-model="form.notes" label="Catatan" placeholder="Opsional" />
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="formLines.length === 0" @click="submitForm">
          Simpan Draft
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
