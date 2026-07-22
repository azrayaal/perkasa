<script setup lang="ts">
import { computed, ref } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import type { TabItem } from '@/components/ui/BaseTabs.types'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { GROUP_LABEL } from '@/data/chartOfAccounts'
import { getWarehouseSummaries } from '@/services/inventoryService'
import {
  getChartOfAccounts,
  getCustomerRows,
  getProductRows,
  getSupplierRows,
  type CustomerRow,
  type ProductRow,
  type SupplierRow,
} from '@/services/masterService'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatCurrency'
import type { Account, AccountType, NormalBalance, WarehouseSummary } from '@/types'

const loading = ref(true)
const activeTab = ref('customers')
const search = ref('')

const customers = ref<CustomerRow[]>([])
const suppliers = ref<SupplierRow[]>([])
const products = ref<ProductRow[]>([])
const warehouses = ref<WarehouseSummary[]>([])
const accounts = ref<Account[]>([])

async function load(): Promise<void> {
  loading.value = true

  const [customerRows, supplierRows, productRows, warehouseRows, accountRows] = await Promise.all([
    getCustomerRows(),
    getSupplierRows(),
    getProductRows(),
    getWarehouseSummaries(),
    getChartOfAccounts(),
  ])

  customers.value = customerRows
  suppliers.value = supplierRows
  products.value = productRows
  warehouses.value = warehouseRows
  accounts.value = accountRows
  loading.value = false
}

void load()

/* Pencarian hanya berlaku pada tab yang sedang dibuka | bukan pencarian global. */
const term = computed(() => search.value.trim().toLowerCase())

function matches(...fields: string[]): boolean {
  if (!term.value) return true
  return fields.some((field) => field.toLowerCase().includes(term.value))
}

const filteredCustomers = computed(() =>
  customers.value.filter((row) =>
    matches(row.customer.code, row.customer.name, row.customer.city, row.customer.npwp),
  ),
)

const filteredSuppliers = computed(() =>
  suppliers.value.filter((row) =>
    matches(row.supplier.code, row.supplier.name, row.supplier.city, row.supplier.npwp),
  ),
)

const filteredProducts = computed(() =>
  products.value.filter((row) => matches(row.product.sku, row.product.name, row.product.category)),
)

const filteredWarehouses = computed(() =>
  warehouses.value.filter((row) =>
    matches(row.warehouse.code, row.warehouse.name, row.warehouse.city, row.warehouse.manager),
  ),
)

const filteredAccounts = computed(() =>
  accounts.value.filter((row) => matches(row.code, row.name, GROUP_LABEL[row.group])),
)

const tabs = computed<TabItem[]>(() => [
  { key: 'customers', label: 'Pelanggan', count: customers.value.length },
  { key: 'suppliers', label: 'Pemasok', count: suppliers.value.length },
  { key: 'products', label: 'Produk', count: products.value.length },
  { key: 'warehouses', label: 'Gudang', count: warehouses.value.length },
  { key: 'accounts', label: 'Bagan Akun', count: accounts.value.length },
])

const SEARCH_PLACEHOLDER: Record<string, string> = {
  customers: 'Cari kode, nama, kota, atau NPWP pelanggan…',
  suppliers: 'Cari kode, nama, kota, atau NPWP pemasok…',
  products: 'Cari SKU, nama barang, atau kategori…',
  warehouses: 'Cari kode, nama, kota, atau penanggung jawab…',
  accounts: 'Cari kode akun, nama akun, atau kelompok…',
}

const searchPlaceholder = computed(() => SEARCH_PLACEHOLDER[activeTab.value] ?? 'Cari…')

/* Pemakaian plafon & utilisasi gudang dibaca sebagai peringatan di atas 80%. */
const WARNING_THRESHOLD = 80

function barWidth(percent: number): string {
  return `${Math.min(Math.max(percent, 0), 100)}%`
}

function barClass(percent: number): string {
  return percent > WARNING_THRESHOLD ? 'bg-state-warning' : 'bg-brand'
}

/** Tipe akun ditulis dalam Bahasa Indonesia; sumber kebenarannya tetap `AccountType`. */
const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Aset',
  liability: 'Kewajiban',
  equity: 'Ekuitas',
  revenue: 'Pendapatan',
  cogs: 'Harga Pokok',
  expense: 'Beban',
  'other-income': 'Pendapatan Lain',
  'other-expense': 'Beban Lain',
  'tax-expense': 'Pajak Penghasilan',
}

const NORMAL_BALANCE_LABEL: Record<NormalBalance, string> = {
  debit: 'Debit',
  credit: 'Kredit',
}

const customerColumns: TableColumn<CustomerRow>[] = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama' },
  { key: 'npwp', label: 'NPWP' },
  { key: 'term', label: 'Termin' },
  { key: 'creditLimit', label: 'Plafon Kredit', align: 'right' },
  { key: 'outstanding', label: 'Piutang Berjalan', align: 'right' },
  { key: 'usage', label: 'Pemakaian Plafon', align: 'right' },
  { key: 'invoiceCount', label: 'Faktur', align: 'right' },
  { key: 'revenue', label: 'Penjualan', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
]

const supplierColumns: TableColumn<SupplierRow>[] = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama' },
  { key: 'npwp', label: 'NPWP' },
  { key: 'term', label: 'Termin' },
  { key: 'invoiceCount', label: 'Faktur', align: 'right' },
  { key: 'purchaseValue', label: 'Nilai Pembelian', align: 'right' },
  { key: 'outstanding', label: 'Utang Berjalan', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
]

const productColumns: TableColumn<ProductRow>[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Nama' },
  { key: 'category', label: 'Kategori', value: (row) => row.product.category },
  { key: 'unit', label: 'Satuan', value: (row) => row.product.unit },
  { key: 'cost', label: 'Harga Pokok', align: 'right' },
  { key: 'price', label: 'Harga Jual', align: 'right' },
  { key: 'margin', label: 'Marjin', align: 'right' },
  { key: 'onHand', label: 'Stok', align: 'right' },
  { key: 'value', label: 'Nilai Persediaan', align: 'right' },
  { key: 'minStock', label: 'Stok Minimum', align: 'right' },
]

const warehouseColumns: TableColumn<WarehouseSummary>[] = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama', value: (row) => row.warehouse.name },
  { key: 'city', label: 'Kota', value: (row) => row.warehouse.city },
  { key: 'manager', label: 'Penanggung Jawab', value: (row) => row.warehouse.manager },
  { key: 'skuCount', label: 'Jumlah SKU', align: 'right' },
  { key: 'units', label: 'Unit Tersimpan', align: 'right' },
  { key: 'value', label: 'Nilai Persediaan', align: 'right' },
  { key: 'utilization', label: 'Utilisasi Kapasitas', align: 'right' },
]

const accountColumns: TableColumn<Account>[] = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama Akun' },
  { key: 'type', label: 'Tipe', value: (row) => ACCOUNT_TYPE_LABEL[row.type] },
  { key: 'group', label: 'Kelompok', value: (row) => GROUP_LABEL[row.group] },
  { key: 'normalBalance', label: 'Saldo Normal', align: 'right' },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Master Data"
      description="Daftar induk yang dipakai seluruh modul: mitra usaha, barang, gudang, dan bagan akun."
    />

    <LoadingState v-if="loading" :rows="6" />

    <template v-else>
      <BaseCard flush>
        <template #header>
          <div class="flex w-full flex-col gap-3">
            <BaseTabs v-model="activeTab" :tabs="tabs" />

            <label class="relative flex items-center">
              <span class="sr-only">Cari master data</span>
              <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
              <input
                v-model="search"
                type="search"
                :placeholder="searchPlaceholder"
                class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </div>
        </template>

        <!-- Pelanggan -->
        <BaseTable
          v-if="activeTab === 'customers'"
          :columns="customerColumns"
          :rows="filteredCustomers"
          :row-key="(row) => row.customer.id"
        >
          <template #cell-code="{ row }">
            <span class="identifier">{{ row.customer.code }}</span>
          </template>

          <template #cell-name="{ row }">
            <span class="font-medium text-ink-primary">{{ row.customer.name }}</span>
            <span class="block text-xs text-ink-muted">{{ row.customer.city }}</span>
          </template>

          <template #cell-npwp="{ row }">
            <span class="identifier">{{ row.customer.npwp }}</span>
          </template>

          <template #cell-term="{ row }">
            Net {{ row.customer.paymentTermDays }} hari
          </template>

          <template #cell-creditLimit="{ row }">
            <span class="amount">{{ formatCurrency(row.customer.creditLimit) }}</span>
          </template>

          <template #cell-outstanding="{ row }">
            <span class="amount">{{ formatCurrency(row.outstanding) }}</span>
          </template>

          <template #cell-usage="{ row }">
            <div class="flex flex-col items-end gap-1">
              <span
                class="amount text-xs"
                :class="row.creditUsage > WARNING_THRESHOLD ? 'text-state-warning' : 'text-ink-secondary'"
              >
                {{ formatPercent(row.creditUsage) }}
              </span>
              <span class="h-1.5 w-24 overflow-hidden rounded-full bg-surface-alt">
                <span
                  class="block h-full rounded-full"
                  :class="barClass(row.creditUsage)"
                  :style="{ width: barWidth(row.creditUsage) }"
                />
              </span>
            </div>
          </template>

          <template #cell-invoiceCount="{ row }">
            <span class="amount">{{ formatNumber(row.invoiceCount) }}</span>
          </template>

          <template #cell-revenue="{ row }">
            <span class="amount">{{ formatCurrency(row.revenue) }}</span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.customer.status" />
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState
                title="Pelanggan tidak ditemukan"
                description="Ubah kata kunci pencarian."
              />
            </div>
          </template>
        </BaseTable>

        <!-- Pemasok -->
        <BaseTable
          v-else-if="activeTab === 'suppliers'"
          :columns="supplierColumns"
          :rows="filteredSuppliers"
          :row-key="(row) => row.supplier.id"
        >
          <template #cell-code="{ row }">
            <span class="identifier">{{ row.supplier.code }}</span>
          </template>

          <template #cell-name="{ row }">
            <span class="font-medium text-ink-primary">{{ row.supplier.name }}</span>
            <span class="block text-xs text-ink-muted">{{ row.supplier.city }}</span>
          </template>

          <template #cell-npwp="{ row }">
            <span class="identifier">{{ row.supplier.npwp }}</span>
          </template>

          <template #cell-term="{ row }">
            Net {{ row.supplier.paymentTermDays }} hari
          </template>

          <template #cell-invoiceCount="{ row }">
            <span class="amount">{{ formatNumber(row.invoiceCount) }}</span>
          </template>

          <template #cell-purchaseValue="{ row }">
            <span class="amount">{{ formatCurrency(row.purchaseValue) }}</span>
          </template>

          <template #cell-outstanding="{ row }">
            <span class="amount">{{ formatCurrency(row.outstanding) }}</span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.supplier.status" />
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState title="Pemasok tidak ditemukan" description="Ubah kata kunci pencarian." />
            </div>
          </template>
        </BaseTable>

        <!-- Produk -->
        <BaseTable
          v-else-if="activeTab === 'products'"
          :columns="productColumns"
          :rows="filteredProducts"
          :row-key="(row) => row.product.id"
        >
          <template #cell-sku="{ row }">
            <span class="identifier">{{ row.product.sku }}</span>
          </template>

          <template #cell-name="{ row }">
            <span class="font-medium text-ink-primary">{{ row.product.name }}</span>
          </template>

          <template #cell-cost="{ row }">
            <span class="amount">{{ formatCurrency(row.product.cost) }}</span>
          </template>

          <template #cell-price="{ row }">
            <span class="amount">{{ formatCurrency(row.product.price) }}</span>
          </template>

          <template #cell-margin="{ row }">
            <span class="amount">{{ formatPercent(row.marginPercent) }}</span>
          </template>

          <template #cell-onHand="{ row }">
            <span
              class="amount"
              :class="row.onHand <= row.product.minStock ? 'text-state-warning' : ''"
            >
              {{ formatNumber(row.onHand) }}
            </span>
            <span class="block text-xs text-ink-muted">{{ row.product.unit }}</span>
          </template>

          <template #cell-value="{ row }">
            <span class="amount">{{ formatCurrency(row.value) }}</span>
          </template>

          <template #cell-minStock="{ row }">
            <span class="amount text-ink-secondary">{{ formatNumber(row.product.minStock) }}</span>
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState title="Produk tidak ditemukan" description="Ubah kata kunci pencarian." />
            </div>
          </template>
        </BaseTable>

        <!-- Gudang -->
        <BaseTable
          v-else-if="activeTab === 'warehouses'"
          :columns="warehouseColumns"
          :rows="filteredWarehouses"
          :row-key="(row) => row.warehouse.id"
        >
          <template #cell-code="{ row }">
            <span class="identifier">{{ row.warehouse.code }}</span>
          </template>

          <template #cell-skuCount="{ row }">
            <span class="amount">{{ formatNumber(row.skuCount) }}</span>
          </template>

          <template #cell-units="{ row }">
            <span class="amount">{{ formatNumber(row.units) }}</span>
          </template>

          <template #cell-value="{ row }">
            <span class="amount">{{ formatCurrency(row.value) }}</span>
          </template>

          <template #cell-utilization="{ row }">
            <div class="flex flex-col items-end gap-1">
              <span
                class="amount text-xs"
                :class="row.utilization > WARNING_THRESHOLD ? 'text-state-warning' : 'text-ink-secondary'"
              >
                {{ formatPercent(row.utilization) }}
              </span>
              <span class="h-1.5 w-24 overflow-hidden rounded-full bg-surface-alt">
                <span
                  class="block h-full rounded-full"
                  :class="barClass(row.utilization)"
                  :style="{ width: barWidth(row.utilization) }"
                />
              </span>
              <span class="text-xs text-ink-muted">
                kapasitas {{ formatNumber(row.warehouse.capacity) }} unit
              </span>
            </div>
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState title="Gudang tidak ditemukan" description="Ubah kata kunci pencarian." />
            </div>
          </template>
        </BaseTable>

        <!-- Bagan akun -->
        <BaseTable
          v-else
          :columns="accountColumns"
          :rows="filteredAccounts"
          :row-key="(row) => row.code"
        >
          <template #cell-code="{ row }">
            <span class="identifier">{{ row.code }}</span>
          </template>

          <template #cell-name="{ row }">
            <span class="font-medium text-ink-primary">{{ row.name }}</span>

            <!-- Penanda kecil: akun kontra & akun kas punya perlakuan khusus di laporan. -->
            <span
              v-if="row.contra"
              class="ml-2 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-semibold text-ink-secondary"
            >
              Kontra
            </span>
            <span
              v-if="row.cash"
              class="ml-2 rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-ink-primary"
            >
              Kas
            </span>

            <span v-if="row.description" class="block text-xs text-ink-muted">
              {{ row.description }}
            </span>
          </template>

          <template #cell-normalBalance="{ row }">
            <span class="text-ink-secondary">{{ NORMAL_BALANCE_LABEL[row.normalBalance] }}</span>
          </template>

          <template #empty>
            <div class="px-4 pb-4">
              <EmptyState title="Akun tidak ditemukan" description="Ubah kata kunci pencarian." />
            </div>
          </template>
        </BaseTable>
      </BaseCard>

      <IntegrationNote title="Master data adalah kunci yang mengikat modul">
        Satu <strong>productId</strong> yang sama dipakai faktur penjualan, faktur pembelian, dan
        kartu stok | karena itu laporan per produk tidak perlu mencocokkan nama. Begitu pula
        <strong>bagan akun</strong>: setiap dokumen hanya boleh menyentuh buku lewat kode akun di
        sini, sehingga neraca dan laporan keuangan selalu terhubung ke transaksinya.
      </IntegrationNote>
    </template>
  </div>
</template>
