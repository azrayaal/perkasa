<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import JournalEntryList from '@/components/erp/JournalEntryList.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { today } from '@/services/clock'
import { getProducts, getWarehouses } from '@/services/masterService'
import {
  METHOD_LABEL,
  MDR_RATE,
  closeShift,
  createPosTransaction,
  getMyOpenShift,
  getPosReceipt,
  openShift,
  transactionsOfShift,
  type PosReceipt,
} from '@/services/posService'
import { getStockPositions } from '@/services/inventoryService'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { calcTotals } from '@/utils/documentTotals'
import { formatCurrency, formatNumber } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type {
  DocumentLine,
  PosPaymentMethod,
  PosShiftSummary,
  PosTransaction,
  PosTransactionType,
  Product,
  StockPosition,
  TradeInLine,
  Warehouse,
} from '@/types'

const auth = useAuthStore()
const toast = useToastStore()

const loading = ref(true)
const busy = ref(false)

const shift = ref<PosShiftSummary | null>(null)
const products = ref<Product[]>([])
const warehouses = ref<Warehouse[]>([])
const positions = ref<StockPosition[]>([])
const recent = ref<PosTransaction[]>([])

/**
 * Jam terminal. Demo berjalan pada tanggal tetap, tetapi JAM harus bergerak |
 * struk tanpa jam yang masuk akal langsung terasa palsu di depan kasir.
 */
function clockNow(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

async function load(): Promise<void> {
  loading.value = true

  const [shiftResult, productList, warehouseList, positionList] = await Promise.all([
    getMyOpenShift(auth.user?.id ?? ''),
    getProducts(),
    getWarehouses(),
    getStockPositions(today()),
  ])

  shift.value = shiftResult
  products.value = productList
  warehouses.value = warehouseList
  positions.value = positionList
  recent.value = shiftResult ? transactionsOfShift(shiftResult.shift.id).slice(-6).reverse() : []
  loading.value = false
}

watch(() => auth.user?.id, load, { immediate: true })

/* -------------------------------------------------------------------------- */
/* Buka shift                                                                  */
/* -------------------------------------------------------------------------- */

const openForm = ref({ warehouseId: '', openingFloat: 2_000_000 })

watch(warehouses, (list) => {
  if (!openForm.value.warehouseId && list.length > 0) openForm.value.warehouseId = list[0].id
})

async function handleOpenShift(): Promise<void> {
  if (!auth.user) return
  busy.value = true

  try {
    await openShift(
      { warehouseId: openForm.value.warehouseId, openingFloat: openForm.value.openingFloat },
      { id: auth.user.id, name: auth.user.name },
      clockNow(),
    )
    toast.push('Shift dibuka — modal kas awal dipindahkan dari bank ke laci.')
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal membuka shift.', 'error')
  } finally {
    busy.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Keranjang                                                                   */
/* -------------------------------------------------------------------------- */

const mode = ref<PosTransactionType>('sale')
const search = ref('')
const cart = ref<DocumentLine[]>([])
const customerName = ref('')
const method = ref<PosPaymentMethod>('tunai')
const cashTendered = ref(0)

/* Tukar tambah */
const tradeInOn = ref(false)
const tradeInLines = ref<TradeInLine[]>([])
const tradeInVatable = ref(false)

const scrapProducts = computed(() =>
  products.value.filter((product) => product.category === 'Barang Bekas'),
)

/**
 * Katalog terminal. Mode jual menampilkan barang dagang beserta stok di gudang
 * konter; mode beli hanya menampilkan barang bekas, karena konter tidak membeli
 * barang baru dari orang lewat.
 */
const catalog = computed(() => {
  const warehouseId = shift.value?.shift.warehouseId
  const term = search.value.trim().toLowerCase()

  return positions.value
    .filter((position) => {
      const isScrap = position.product.category === 'Barang Bekas'
      if (mode.value === 'buy') return isScrap
      if (isScrap) return false
      return true
    })
    .filter((position) => {
      if (!term) return true
      return (
        position.product.name.toLowerCase().includes(term) ||
        position.product.sku.toLowerCase().includes(term)
      )
    })
    .map((position) => ({
      product: position.product,
      stock: position.byWarehouse.find((row) => row.warehouse.id === warehouseId)?.qty ?? 0,
    }))
})

const vatRate = 11

/** Pembelian barang bekas dari perorangan tidak ber-PPN. */
const totals = computed(() => calcTotals(cart.value, mode.value === 'sale' ? vatRate : 0))

const tradeInTotal = computed(() => {
  if (!tradeInOn.value) return 0
  const dpp = tradeInLines.value.reduce((sum, line) => sum + line.qty * line.unitValue, 0)
  return dpp + (tradeInVatable.value ? Math.round((dpp * vatRate) / 100) : 0)
})

const netDue = computed(() => totals.value.total - tradeInTotal.value)
const change = computed(() => Math.max(0, cashTendered.value - netDue.value))
const mdrFee = computed(() => Math.round((netDue.value * MDR_RATE[method.value]) / 100))

const cashShort = computed(
  () => mode.value === 'sale' && method.value === 'tunai' && cashTendered.value < netDue.value,
)

/** Alasan transaksi belum bisa diselesaikan; `null` berarti siap dibayar. */
const blocker = computed<string | null>(() => {
  if (cart.value.length === 0) return null
  if (netDue.value < 0) {
    return 'Nilai tukar tambah melebihi total belanja. Kurangi kuantitasnya atau tambah barang.'
  }
  if (cashShort.value) return 'Uang yang diterima masih kurang dari yang harus dibayar.'
  return null
})

const canSubmit = computed(() => cart.value.length > 0 && blocker.value === null && !busy.value)

function productOf(productId: string): Product | undefined {
  return products.value.find((product) => product.id === productId)
}

function addToCart(product: Product): void {
  const existing = cart.value.find((line) => line.productId === product.id)

  if (existing) {
    existing.qty += 1
    return
  }

  cart.value = [
    ...cart.value,
    {
      productId: product.id,
      qty: 1,
      // Mode beli: harga tebus dimulai dari harga pokok, lalu ditawar kasir.
      unitPrice: mode.value === 'sale' ? product.price : product.cost,
      discountPercent: 0,
    },
  ]
}

function removeLine(index: number): void {
  cart.value = cart.value.filter((_, position) => position !== index)
}

function resetCart(): void {
  cart.value = []
  customerName.value = ''
  method.value = 'tunai'
  cashTendered.value = 0
  tradeInOn.value = false
  tradeInLines.value = []
  tradeInVatable.value = false
  search.value = ''
}

// Ganti mode = keranjang dikosongkan; menjual dan membeli tidak boleh tercampur
// dalam satu struk karena arah uang dan jurnalnya berlawanan.
watch(mode, resetCart)

watch(tradeInOn, (on) => {
  const first = scrapProducts.value[0]
  if (!on || !first) {
    tradeInLines.value = []
    return
  }

  // Kuantitas awal dikira-kira dari isi keranjang, bukan angka tetap: keranjang
  // konter kecil, dan nilai tukar tambah tidak boleh melampaui belanjaannya.
  const budget = totals.value.total * 0.3
  const qty = Math.max(1, Math.floor(budget / first.cost))
  tradeInLines.value = [{ productId: first.id, qty, unitValue: first.cost }]
})

/** Uang pas | tombol pintas yang paling sering dipakai kasir. */
function tenderExact(): void {
  cashTendered.value = netDue.value
}

function tenderRound(step: number): void {
  cashTendered.value = Math.ceil(netDue.value / step) * step
}

/* -------------------------------------------------------------------------- */
/* Bayar                                                                       */
/* -------------------------------------------------------------------------- */

const receipt = ref<PosReceipt | null>(null)

async function submit(): Promise<void> {
  if (!shift.value) return
  busy.value = true

  try {
    const created = await createPosTransaction(
      {
        shiftId: shift.value.shift.id,
        type: mode.value,
        customerName: customerName.value,
        lines: cart.value,
        method: method.value,
        cashTendered: cashTendered.value,
        tradeIn: tradeInOn.value
          ? { lines: tradeInLines.value, vatable: tradeInVatable.value }
          : undefined,
      },
      clockNow(),
    )

    receipt.value = await getPosReceipt(created.id)
    resetCart()
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Transaksi gagal.', 'error')
  } finally {
    busy.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Tutup shift                                                                 */
/* -------------------------------------------------------------------------- */

const closeOpen = ref(false)
const closeForm = ref({ countedCash: 0, depositedAmount: 0, notes: '' })

function openCloseDialog(): void {
  if (!shift.value) return
  const expected = shift.value.expectedCash
  closeForm.value = {
    countedCash: expected,
    // Modal Rp 2 juta lazim ditinggal untuk kembalian esok hari.
    depositedAmount: Math.max(0, expected - 2_000_000),
    notes: '',
  }
  closeOpen.value = true
}

const closeDifference = computed(
  () => closeForm.value.countedCash - (shift.value?.expectedCash ?? 0),
)

async function handleCloseShift(): Promise<void> {
  if (!shift.value) return
  busy.value = true

  try {
    await closeShift(
      {
        shiftId: shift.value.shift.id,
        countedCash: closeForm.value.countedCash,
        depositedAmount: closeForm.value.depositedAmount,
        notes: closeForm.value.notes || undefined,
      },
      clockNow(),
    )

    closeOpen.value = false
    toast.push('Shift ditutup — setoran dan selisih kas sudah dijurnal.')
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menutup shift.', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <LoadingState v-if="loading" :rows="6" />

    <!-- Tanpa shift terbuka, terminal terkunci: tidak ada laci yang bisa
         dipertanggungjawabkan, jadi tidak boleh ada uang yang berpindah. -->
    <template v-else-if="!shift">
      <PageHeader
        title="Terminal POS"
        description="Buka shift terlebih dahulu untuk mulai melayani pembeli di konter."
      />

      <BaseCard title="Buka Shift Kasir" subtitle="Modal kas awal diambil dari rekening bank">
        <form class="flex flex-col gap-4" @submit.prevent="handleOpenShift">
          <label class="flex w-full flex-col gap-2">
            <span class="text-sm font-medium text-ink-secondary">Konter / gudang</span>
            <select
              v-model="openForm.warehouseId"
              class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
          </label>

          <BaseInput
            v-model.number="openForm.openingFloat"
            label="Modal kas awal (uang kembalian)"
            type="number"
            hint="Dipindahkan dari akun 1110 Bank BCA ke akun 1130 Kas Kasir."
          />

          <div>
            <BaseButton :loading="busy" icon="drawer" @click="handleOpenShift">
              Buka Shift
            </BaseButton>
          </div>
        </form>
      </BaseCard>

      <IntegrationNote title="Kenapa harus buka shift dulu">
        Uang fisik di laci selalu harus ada penanggung jawabnya. Shift mengikat setiap struk ke satu
        kasir, sehingga saat laci dihitung ulang di akhir hari, selisihnya bisa ditelusuri — bukan
        sekadar dibulatkan diam-diam.
      </IntegrationNote>
    </template>

    <template v-else>
      <PageHeader
        title="Terminal POS"
        :description="`${shift.warehouseName} · shift ${shift.shift.number} dibuka ${shift.shift.openedAt}`"
      >
        <template #actions>
          <BaseBadge status="open" />
          <BaseButton variant="secondary" icon="drawer" @click="openCloseDialog">
            Tutup Shift
          </BaseButton>
        </template>
      </PageHeader>

      <!-- Papan ringkas laci: yang paling ingin diketahui kasir sepanjang hari. -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-card border border-line bg-surface p-4">
          <p class="text-small text-ink-secondary">Transaksi</p>
          <p class="amount mt-1 text-h3 text-ink-primary">{{ shift.transactionCount }}</p>
        </div>
        <div class="rounded-card border border-line bg-surface p-4">
          <p class="text-small text-ink-secondary">Penjualan tunai</p>
          <p class="amount mt-1 text-h3 text-ink-primary">{{ formatCurrency(shift.cashSales) }}</p>
        </div>
        <div class="rounded-card border border-line bg-surface p-4">
          <p class="text-small text-ink-secondary">Non-tunai</p>
          <p class="amount mt-1 text-h3 text-ink-primary">{{ formatCurrency(shift.nonCashSales) }}</p>
        </div>
        <div class="rounded-card border-transparent bg-brand p-4 text-brand-ink">
          <p class="text-small opacity-70">Kas di laci</p>
          <p class="amount mt-1 text-h3">{{ formatCurrency(shift.expectedCash) }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <!-- Katalog -->
        <div class="flex flex-col gap-4 xl:col-span-3">
          <BaseCard flush>
            <template #header>
              <div class="flex w-full flex-col gap-3">
                <!-- Mode jual/beli paling atas: ia mengubah arti seluruh layar. -->
                <div class="inline-flex rounded-control bg-surface-alt p-1">
                  <button
                    v-for="option in (['sale', 'buy'] as PosTransactionType[])"
                    :key="option"
                    type="button"
                    class="flex-1 rounded-control px-4 py-2 text-small font-semibold transition-colors"
                    :class="
                      mode === option
                        ? 'bg-surface text-ink-primary shadow-raised'
                        : 'text-ink-secondary hover:text-ink-primary'
                    "
                    @click="mode = option"
                  >
                    {{ option === 'sale' ? 'Jual Barang' : 'Beli Barang Bekas' }}
                  </button>
                </div>

                <label class="relative flex items-center">
                  <span class="sr-only">Cari barang</span>
                  <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
                  <input
                    v-model="search"
                    type="search"
                    placeholder="Cari nama barang atau SKU…"
                    class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
              </div>
            </template>

            <div class="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
              <button
                v-for="item in catalog"
                :key="item.product.id"
                type="button"
                class="flex flex-col rounded-control border border-line p-3 text-left transition-colors hover:border-brand hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-45"
                :disabled="mode === 'sale' && item.stock <= 0"
                @click="addToCart(item.product)"
              >
                <span class="identifier">{{ item.product.sku }}</span>
                <span class="mt-0.5 line-clamp-2 text-small font-medium text-ink-primary">
                  {{ item.product.name }}
                </span>
                <span class="amount mt-1.5 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(mode === 'sale' ? item.product.price : item.product.cost) }}
                </span>
                <span
                  class="text-xs"
                  :class="item.stock <= 0 ? 'text-state-error' : 'text-ink-muted'"
                >
                  {{ mode === 'sale' ? `Stok ${formatNumber(item.stock)} ${item.product.unit}` : `per ${item.product.unit}` }}
                </span>
              </button>
            </div>

            <EmptyState
              v-if="catalog.length === 0"
              title="Barang tidak ditemukan"
              description="Coba kata kunci lain."
            />
          </BaseCard>

          <BaseCard v-if="recent.length > 0" title="Transaksi Terakhir Shift Ini" flush>
            <ul class="divide-y divide-line">
              <li
                v-for="row in recent"
                :key="row.id"
                class="flex items-center gap-3 px-5 py-2.5"
              >
                <span class="identifier shrink-0">{{ row.number }}</span>
                <span class="min-w-0 flex-1 truncate text-small text-ink-secondary">
                  {{ row.time }} · {{ row.customerName }}
                </span>
                <BaseBadge :status="row.method" class="shrink-0" />
                <span class="amount shrink-0 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(row.netDue) }}
                </span>
              </li>
            </ul>
          </BaseCard>
        </div>

        <!-- Keranjang & pembayaran -->
        <div class="xl:col-span-2">
          <BaseCard
            class="sticky top-20"
            :title="mode === 'sale' ? 'Keranjang' : 'Barang Bekas Dibeli'"
            flush
          >
            <div class="max-h-64 overflow-y-auto">
              <EmptyState
                v-if="cart.length === 0"
                title="Belum ada barang"
                description="Pilih barang dari katalog di sebelah kiri."
              />

              <ul v-else class="divide-y divide-line">
                <li v-for="(line, index) in cart" :key="index" class="px-4 py-3">
                  <div class="flex items-start justify-between gap-2">
                    <span class="min-w-0 flex-1 text-small font-medium text-ink-primary">
                      {{ productOf(line.productId)?.name }}
                    </span>
                    <button
                      type="button"
                      class="rounded p-1 text-ink-muted transition-colors hover:bg-state-error/10 hover:text-state-error"
                      aria-label="Hapus barang"
                      @click="removeLine(index)"
                    >
                      <BaseIcon name="close" :size="14" />
                    </button>
                  </div>

                  <div class="mt-1.5 flex items-center gap-2">
                    <div class="flex items-center rounded-control border border-line">
                      <button
                        type="button"
                        class="px-2.5 py-1 text-ink-secondary transition-colors hover:text-ink-primary"
                        aria-label="Kurangi"
                        @click="line.qty = Math.max(1, line.qty - 1)"
                      >
                        <BaseIcon name="minus" :size="14" />
                      </button>
                      <input
                        v-model.number="line.qty"
                        type="number"
                        min="1"
                        class="w-14 border-x border-line bg-transparent py-1 text-center text-data text-ink-primary outline-none"
                      />
                      <button
                        type="button"
                        class="px-2.5 py-1 text-ink-secondary transition-colors hover:text-ink-primary"
                        aria-label="Tambah"
                        @click="line.qty += 1"
                      >
                        <BaseIcon name="plus" :size="14" />
                      </button>
                    </div>

                    <input
                      v-model.number="line.unitPrice"
                      type="number"
                      min="0"
                      step="500"
                      class="w-full rounded-control border border-line bg-surface-alt px-2 py-1 text-right text-data text-ink-primary outline-none focus:border-brand"
                    />
                  </div>

                  <p class="amount mt-1 text-right text-small font-semibold text-ink-primary">
                    {{ formatCurrency(line.qty * line.unitPrice) }}
                  </p>
                </li>
              </ul>
            </div>

            <div class="border-t border-line px-4 py-3">
              <BaseInput v-model="customerName" label="Nama pembeli" placeholder="Opsional" />

              <!-- Tukar tambah hanya masuk akal saat menjual. -->
              <label
                v-if="mode === 'sale' && scrapProducts.length > 0"
                class="mt-3 flex items-start gap-2.5"
              >
                <input
                  v-model="tradeInOn"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-ink-strong focus:ring-brand/30"
                />
                <span class="text-small">
                  <span class="font-semibold text-ink-primary">Tukar tambah besi bekas</span>
                  <span class="block text-ink-secondary">Memotong yang harus dibayar.</span>
                </span>
              </label>

              <div v-if="tradeInOn" class="mt-2 flex flex-col gap-2">
                <div
                  v-for="(line, index) in tradeInLines"
                  :key="index"
                  class="rounded-control border border-line bg-surface-alt/60 p-2.5"
                >
                  <select
                    v-model="line.productId"
                    class="w-full rounded-control border border-line bg-surface px-2 py-1.5 text-small text-ink-primary outline-none focus:border-brand"
                  >
                    <option v-for="product in scrapProducts" :key="product.id" :value="product.id">
                      {{ product.name }}
                    </option>
                  </select>
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <input
                      v-model.number="line.qty"
                      type="number"
                      min="1"
                      class="rounded-control border border-line bg-surface px-2 py-1.5 text-data text-ink-primary outline-none focus:border-brand"
                      :aria-label="`Kuantitas ${productOf(line.productId)?.unit ?? ''}`"
                    />
                    <input
                      v-model.number="line.unitValue"
                      type="number"
                      min="0"
                      step="100"
                      class="rounded-control border border-line bg-surface px-2 py-1.5 text-right text-data text-ink-primary outline-none focus:border-brand"
                      aria-label="Nilai tebus per unit"
                    />
                  </div>
                </div>

                <label class="flex items-start gap-2 text-xs text-ink-secondary">
                  <input
                    v-model="tradeInVatable"
                    type="checkbox"
                    class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-line text-ink-strong focus:ring-brand/30"
                  />
                  Pembeli PKP dan menerbitkan faktur pajak
                </label>
              </div>
            </div>

            <!-- Rincian uang -->
            <dl class="border-t border-line bg-surface-alt/60 px-4 py-3 text-data">
              <div class="flex justify-between py-0.5">
                <dt class="text-ink-secondary">Subtotal</dt>
                <dd class="amount">{{ formatCurrency(totals.dpp) }}</dd>
              </div>
              <div v-if="mode === 'sale'" class="flex justify-between py-0.5">
                <dt class="text-ink-secondary">PPN {{ vatRate }}%</dt>
                <dd class="amount">{{ formatCurrency(totals.ppn) }}</dd>
              </div>
              <div v-if="tradeInTotal > 0" class="flex justify-between py-0.5">
                <dt class="text-ink-secondary">Tukar tambah</dt>
                <dd class="amount">-{{ formatCurrency(tradeInTotal) }}</dd>
              </div>
              <div class="mt-1 flex items-baseline justify-between border-t border-line pt-2">
                <dt class="font-semibold text-ink-primary">
                  {{ mode === 'sale' ? 'Harus dibayar' : 'Dibayarkan tunai' }}
                </dt>
                <dd class="amount text-h3 font-bold text-ink-primary">
                  {{ formatCurrency(netDue) }}
                </dd>
              </div>
            </dl>

            <div v-if="mode === 'sale'" class="border-t border-line px-4 py-3">
              <p class="mb-2 text-sm font-medium text-ink-secondary">Metode pembayaran</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="option in (['tunai', 'qris', 'debit'] as PosPaymentMethod[])"
                  :key="option"
                  type="button"
                  class="rounded-control border px-2 py-2 text-small font-semibold transition-colors"
                  :class="
                    method === option
                      ? 'border-transparent bg-brand text-brand-ink'
                      : 'border-line text-ink-secondary hover:border-brand hover:text-ink-primary'
                  "
                  @click="method = option"
                >
                  {{ METHOD_LABEL[option] }}
                </button>
              </div>

              <div v-if="method === 'tunai'" class="mt-3">
                <BaseInput
                  v-model.number="cashTendered"
                  label="Uang diterima"
                  type="number"
                  :error="cashShort ? 'Uang yang diterima masih kurang.' : undefined"
                />

                <!-- Pecahan cepat: kasir jarang sempat mengetik nominal penuh. -->
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-control border border-line px-2.5 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
                    @click="tenderExact"
                  >
                    Uang pas
                  </button>
                  <button
                    v-for="step in [50_000, 100_000, 500_000]"
                    :key="step"
                    type="button"
                    class="rounded-control border border-line px-2.5 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
                    @click="tenderRound(step)"
                  >
                    Bulat {{ formatNumber(step / 1000) }}rb
                  </button>
                </div>

                <div class="mt-2 flex justify-between text-data">
                  <span class="text-ink-secondary">Kembalian</span>
                  <span class="amount text-h4 font-bold text-ink-primary">
                    {{ formatCurrency(change) }}
                  </span>
                </div>
              </div>

              <p v-else class="mt-3 text-small text-ink-secondary">
                Dana masuk ke akun 1250 Piutang Penyelenggara Pembayaran dan cair H+1, dipotong MDR
                {{ MDR_RATE[method] }}% sebesar
                <span class="amount font-semibold text-ink-primary">{{ formatCurrency(mdrFee) }}</span>.
              </p>
            </div>

            <div class="border-t border-line px-4 py-3">
              <!--
                Tombol yang mati tanpa keterangan membuat kasir menebak-nebak di
                depan antrean. Sebutkan halangannya secara eksplisit.
              -->
              <p
                v-if="blocker"
                class="mb-2 text-small font-medium text-state-error"
                role="alert"
              >
                {{ blocker }}
              </p>

              <BaseButton block :disabled="!canSubmit" :loading="busy" icon="check" @click="submit">
                {{ mode === 'sale' ? 'Bayar & Cetak Struk' : 'Bayar Tunai ke Penjual' }}
              </BaseButton>
            </div>
          </BaseCard>
        </div>
      </div>

      <IntegrationNote title="Satu struk, seluruh buku ikut bergerak">
        Setiap transaksi kasir langsung mengurangi stok {{ shift.warehouseName }}, membentuk jurnal
        Kas Kasir–Penjualan–PPN beserta HPP–Persediaan, dan PPN keluarannya masuk ke SPT Masa PPN
        yang sama dengan faktur bertermin. Pembayaran QRIS dan debit sengaja tidak diakui sebagai kas
        sampai dananya benar-benar cair, supaya saldo bank di Neraca cocok dengan rekening koran.
      </IntegrationNote>
    </template>

    <!-- Struk hasil transaksi -->
    <BaseModal
      :open="receipt !== null"
      title="Transaksi Berhasil"
      description="Struk sudah dibukukan — jurnalnya terbentuk saat itu juga."
      @close="receipt = null"
    >
      <div v-if="receipt" class="flex flex-col gap-4">
        <div class="rounded-card border border-line bg-surface-alt/60 p-4">
          <div class="text-center">
            <p class="font-semibold text-ink-primary">Perkasa ERP</p>
            <p class="identifier">{{ receipt.transaction.number }}</p>
            <p class="text-xs text-ink-muted">
              {{ formatDate(receipt.transaction.date) }} {{ receipt.transaction.time }} ·
              {{ receipt.transaction.cashierName }}
            </p>
          </div>

          <ul class="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            <li
              v-for="(line, index) in receipt.transaction.lines"
              :key="index"
              class="flex justify-between gap-3 text-small"
            >
              <span class="min-w-0 flex-1 truncate text-ink-primary">
                {{ productOf(line.productId)?.name }}
                <span class="text-ink-muted">
                  {{ formatNumber(line.qty) }} × {{ formatCurrency(line.unitPrice) }}
                </span>
              </span>
              <span class="amount shrink-0">{{ formatCurrency(line.qty * line.unitPrice) }}</span>
            </li>
          </ul>

          <dl class="mt-3 border-t border-line pt-3 text-small">
            <div v-if="receipt.transaction.tradeIn" class="flex justify-between py-0.5">
              <dt class="text-ink-secondary">Tukar tambah</dt>
              <dd class="amount">-{{ formatCurrency(receipt.transaction.tradeIn.total) }}</dd>
            </div>
            <div class="flex justify-between border-t border-line py-1.5">
              <dt class="font-semibold text-ink-primary">Dibayar</dt>
              <dd class="amount font-bold">{{ formatCurrency(receipt.transaction.netDue) }}</dd>
            </div>
            <div v-if="receipt.transaction.method === 'tunai'" class="flex justify-between py-0.5">
              <dt class="text-ink-secondary">Tunai / kembalian</dt>
              <dd class="amount">
                {{ formatCurrency(receipt.transaction.cashTendered) }} /
                {{ formatCurrency(receipt.transaction.change) }}
              </dd>
            </div>
            <div v-else class="flex justify-between py-0.5">
              <dt class="text-ink-secondary">Metode</dt>
              <dd><BaseBadge :status="receipt.transaction.method" /></dd>
            </div>
          </dl>
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-ink-secondary">Jurnal otomatis dari struk ini</p>
          <JournalEntryList :entries="receipt.journal" compact />
        </div>
      </div>

      <template #footer>
        <BaseButton @click="receipt = null">Transaksi Berikutnya</BaseButton>
      </template>
    </BaseModal>

    <!-- Tutup shift -->
    <BaseModal
      :open="closeOpen"
      title="Tutup Shift Kasir"
      description="Hitung uang fisik di laci, lalu setorkan ke bank."
      @close="closeOpen = false"
    >
      <div v-if="shift" class="flex flex-col gap-4">
        <dl class="rounded-control border border-line bg-surface-alt/60 px-4 py-3 text-data">
          <div class="flex justify-between py-0.5">
            <dt class="text-ink-secondary">Modal kas awal</dt>
            <dd class="amount">{{ formatCurrency(shift.shift.openingFloat) }}</dd>
          </div>
          <div class="flex justify-between py-0.5">
            <dt class="text-ink-secondary">Penjualan tunai</dt>
            <dd class="amount">+{{ formatCurrency(shift.cashSales) }}</dd>
          </div>
          <div class="flex justify-between py-0.5">
            <dt class="text-ink-secondary">Beli barang bekas</dt>
            <dd class="amount">-{{ formatCurrency(shift.cashPurchases) }}</dd>
          </div>
          <div class="mt-1 flex justify-between border-t border-line pt-2">
            <dt class="font-semibold text-ink-primary">Kas seharusnya</dt>
            <dd class="amount font-bold">{{ formatCurrency(shift.expectedCash) }}</dd>
          </div>
        </dl>

        <BaseInput
          v-model.number="closeForm.countedCash"
          label="Hasil hitung fisik"
          type="number"
        />

        <BaseCallout
          v-if="closeDifference !== 0"
          :tone="closeDifference < 0 ? 'danger' : 'warning'"
          :title="closeDifference < 0 ? 'Laci kurang' : 'Laci lebih'"
        >
          Selisih {{ formatCurrency(Math.abs(closeDifference)) }} akan dijurnal ke akun 7200 Selisih
          Kas dan langsung terlihat di Laba Rugi.
        </BaseCallout>

        <BaseInput
          v-model.number="closeForm.depositedAmount"
          label="Disetor ke bank"
          type="number"
          :hint="`Sisa ${formatCurrency(Math.max(0, closeForm.countedCash - closeForm.depositedAmount))} ditinggal di laci untuk kembalian besok.`"
        />

        <BaseInput v-model="closeForm.notes" label="Catatan" placeholder="Opsional" />
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="closeOpen = false">Batal</BaseButton>
        <BaseButton :loading="busy" @click="handleCloseShift">Tutup Shift</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
