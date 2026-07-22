<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DocumentLineEditor from '@/components/erp/DocumentLineEditor.vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
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
import { getCompanyProfile, getProducts, getSuppliers, getWarehouses } from '@/services/masterService'
import { createPurchaseInvoice, getPurchaseRows } from '@/services/purchaseService'
import { ROUTE } from '@/router/routeNames'
import { usePeriodStore } from '@/stores/periodStore'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type {
  DocumentLine,
  DocumentStatus,
  Product,
  PurchaseRow,
  Supplier,
  Warehouse,
} from '@/types'

const router = useRouter()
const toast = useToastStore()
const period = usePeriodStore()

const rows = ref<PurchaseRow[]>([])
const loading = ref(true)

/* Filter tabel */
const search = ref('')
const statusFilter = ref<DocumentStatus | 'all'>('all')

// Faktur pembelian tidak pernah berstatus draft | barang sudah diterima gudang
// saat dokumennya dicatat, jadi pilihan draft sengaja tidak ditawarkan.
const STATUS_OPTIONS: Array<{ value: DocumentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Semua status' },
  { value: 'posted', label: 'Terposting' },
  { value: 'partial', label: 'Dibayar sebagian' },
  { value: 'paid', label: 'Lunas' },
  { value: 'overdue', label: 'Jatuh tempo' },
]

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getPurchaseRows(period.from, period.to)
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
      row.supplierName.toLowerCase().includes(term)
    )
  })
})

const summary = computed(() => ({
  purchase: rows.value.reduce((sum, row) => sum + row.invoice.totals.dpp, 0),
  payable: rows.value.reduce((sum, row) => sum + row.outstanding, 0),
  overdue: rows.value
    .filter((row) => row.status === 'overdue')
    .reduce((sum, row) => sum + row.outstanding, 0),
  inputVat: rows.value.reduce((sum, row) => sum + row.invoice.totals.ppn, 0),
  overdueCount: rows.value.filter((row) => row.status === 'overdue').length,
}))

const columns: TableColumn<PurchaseRow>[] = [
  { key: 'number', label: 'No. Faktur' },
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.invoice.date) },
  { key: 'supplier', label: 'Pemasok' },
  { key: 'dpp', label: 'DPP', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'outstanding', label: 'Sisa Utang', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

function openDetail(row: PurchaseRow): void {
  void router.push({ name: ROUTE.purchaseDetail, params: { id: row.invoice.id } })
}

/* -------------------------------------------------------------------------- */
/* Form faktur baru                                                            */
/* -------------------------------------------------------------------------- */

const formOpen = ref(false)
const saving = ref(false)

const suppliers = ref<Supplier[]>([])
const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const vatRate = ref(11)

const form = ref({
  date: today(),
  supplierId: '',
  warehouseId: '',
  notes: '',
})

const formLines = ref<DocumentLine[]>([])

async function openForm(): Promise<void> {
  formOpen.value = true

  if (suppliers.value.length === 0) {
    const [supplierList, productList, warehouseList, company] = await Promise.all([
      getSuppliers(),
      getProducts(),
      getWarehouses(),
      getCompanyProfile(),
    ])

    suppliers.value = supplierList.filter((supplier) => supplier.status === 'active')
    products.value = productList
    warehouses.value = warehouseList
    vatRate.value = company.vatRate
  }

  form.value = {
    date: today(),
    supplierId: suppliers.value[0]?.id ?? '',
    warehouseId: warehouses.value[0]?.id ?? '',
    notes: '',
  }

  const firstProduct = products.value[0]
  formLines.value = firstProduct
    ? [{ productId: firstProduct.id, qty: 50, unitPrice: firstProduct.cost, discountPercent: 0 }]
    : []
}

async function submitForm(): Promise<void> {
  saving.value = true

  try {
    const created = await createPurchaseInvoice({
      date: form.value.date,
      supplierId: form.value.supplierId,
      warehouseId: form.value.warehouseId,
      lines: formLines.value,
      notes: form.value.notes || undefined,
    })

    formOpen.value = false
    toast.push(`Faktur ${created.number} tercatat: stok masuk dan utang usaha terbentuk.`)
    await load()
    void router.push({ name: ROUTE.purchaseDetail, params: { id: created.id } })
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menyimpan faktur.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Pembelian"
      :description="`Faktur pembelian periode ${period.label}. Barang langsung diterima gudang, utang usaha dan PPN masukan tercatat seketika.`"
    >
      <template #actions>
        <BaseButton icon="plus" @click="openForm">Faktur Pembelian Baru</BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Pembelian (DPP)"
          :value="formatCurrency(summary.purchase)"
          icon="purchase"
          tone="brand"
          :caption="`${rows.length} faktur`"
        />
        <StatCard
          label="Utang Usaha"
          :value="formatCurrency(summary.payable)"
          icon="cash"
          caption="Belum dibayar ke pemasok"
        />
        <StatCard
          label="Jatuh Tempo"
          :value="formatCurrency(summary.overdue)"
          icon="alert"
          :tone="summary.overdue > 0 ? 'error' : 'plain'"
          :caption="`${summary.overdueCount} faktur lewat tempo`"
        />
        <StatCard
          label="PPN Masukan"
          :value="formatCurrency(summary.inputVat)"
          icon="tax"
          caption="Kredit pajak periode ini"
        />
      </div>

      <BaseCard flush>
        <template #header>
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <label class="relative flex min-w-0 flex-1 items-center">
              <span class="sr-only">Cari faktur pembelian</span>
              <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
              <input
                v-model="search"
                type="search"
                placeholder="Cari nomor faktur atau pemasok…"
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
            <span v-if="!row.invoice.taxInvoiceNumber" class="block text-xs text-state-warning">
              Faktur pajak masukan belum diterima
            </span>
          </template>

          <template #cell-supplier="{ row }">
            <span class="font-medium text-ink-primary">{{ row.supplierName }}</span>
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
              {{ row.outstanding > 0 ? formatCurrency(row.outstanding) : '|' }}
            </span>
            <span v-if="row.overdueDays > 0" class="block text-xs text-state-error">
              {{ row.overdueDays }} hari lewat tempo
            </span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.status" />
          </template>

          <template #cell-actions>
            <BaseIcon name="forward" :size="16" class="ml-auto text-ink-muted" />
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState
                title="Belum ada faktur pembelian"
                description="Ubah filter periode di topbar, atau catat faktur pembelian baru."
              />
            </div>
          </template>
        </BaseTable>
      </BaseCard>

      <IntegrationNote title="Dari faktur pemasok ke gudang, neraca, dan SPT">
        Barang pada faktur ini langsung masuk kartu stok gudang penerima, sehingga nilai persediaan
        (akun <strong>1300</strong>) naik sebesar harga pokoknya. Nilai fakturnya menambah
        <strong>Utang Usaha (2100)</strong> yang akan tampak di Neraca sampai dibayar, sementara PPN
        masukan (akun <strong>1400</strong>) menjadi kredit pajak yang mengurangi PPN kurang bayar di
        modul <strong>Perpajakan</strong>.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="formOpen"
      title="Faktur Pembelian Baru"
      description="Begitu disimpan: barang masuk kartu stok, utang usaha dan PPN masukan langsung terbentuk."
      @close="formOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitForm">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.date" label="Tanggal faktur" type="date" required />

          <label class="flex w-full flex-col gap-2">
            <span class="text-sm font-medium text-ink-secondary">
              Pemasok <span class="text-state-error">*</span>
            </span>
            <select
              v-model="form.supplierId"
              required
              class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                {{ supplier.name }} · Net {{ supplier.paymentTermDays }}
              </option>
            </select>
          </label>

          <label class="flex w-full flex-col gap-2 sm:col-span-2">
            <span class="text-sm font-medium text-ink-secondary">
              Gudang penerima <span class="text-state-error">*</span>
            </span>
            <select
              v-model="form.warehouseId"
              required
              class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }} | {{ warehouse.city }}
              </option>
            </select>
          </label>
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-ink-secondary">Barang diterima</p>
          <DocumentLineEditor
            v-model="formLines"
            :products="products"
            :vat-rate="vatRate"
            price-field="cost"
          />
        </div>

        <BaseInput v-model="form.notes" label="Catatan" placeholder="Opsional" />
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="formLines.length === 0" @click="submitForm">
          Simpan Faktur
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
