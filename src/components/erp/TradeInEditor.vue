<script setup lang="ts">
import { computed } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { formatCurrency } from '@/utils/formatCurrency'
import type { Product, TradeInLine, Warehouse } from '@/types'

/**
 * Penyunting tukar tambah: barang bekas yang diserahkan pelanggan sebagai
 * potongan pembayaran.
 *
 * Nilai tukar tambah TIDAK dihitung sebagai diskon. Karena itu komponen ini
 * menampilkan dua angka berbeda secara eksplisit | total faktur tetap utuh,
 * dan yang berkurang adalah uang yang harus dibayar pelanggan.
 */
const props = defineProps<{
  /** Hanya produk berkategori "Barang Bekas". */
  products: Product[]
  warehouses: Warehouse[]
  vatRate: number
  /** Total faktur penjualan, untuk menghitung sisa yang harus dibayar. */
  invoiceTotal: number
}>()

const model = defineModel<{
  lines: TradeInLine[]
  warehouseId: string
  vatable: boolean
}>({ required: true })

const productById = computed(() => new Map(props.products.map((product) => [product.id, product])))

const dpp = computed(() =>
  model.value.lines.reduce((sum, line) => sum + line.qty * line.unitValue, 0),
)
const ppn = computed(() =>
  model.value.vatable ? Math.round((dpp.value * props.vatRate) / 100) : 0,
)
const total = computed(() => dpp.value + ppn.value)

/** Negatif berarti nilai barang bekas melampaui tagihan | ditolak service. */
const remaining = computed(() => props.invoiceTotal - total.value)

function addLine(): void {
  const first = props.products[0]
  if (!first) return
  model.value.lines = [...model.value.lines, { productId: first.id, qty: 100, unitValue: first.cost }]
}

function removeLine(index: number): void {
  model.value.lines = model.value.lines.filter((_, position) => position !== index)
}

/** Ganti produk = nilai tebus ikut menyesuaikan harga pokok standarnya. */
function onProductChange(index: number, productId: string): void {
  const product = productById.value.get(productId)
  if (!product) return

  model.value.lines = model.value.lines.map((line, position) =>
    position === index ? { ...line, productId, unitValue: product.cost } : line,
  )
}

function unitOf(productId: string): string {
  return productById.value.get(productId)?.unit ?? ''
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex w-full flex-col gap-2">
      <span class="text-sm font-medium text-ink-secondary">Gudang penerima barang bekas</span>
      <select
        v-model="model.warehouseId"
        class="w-full rounded-control border border-line bg-surface px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
          {{ warehouse.name }}
        </option>
      </select>
    </label>

    <div
      v-for="(line, index) in model.lines"
      :key="index"
      class="rounded-control border border-line bg-surface-alt/50 p-3"
    >
      <div class="flex items-start gap-2">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Barang bekas</span>
          <select
            :value="line.productId"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            @change="onProductChange(index, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="product in products" :key="product.id" :value="product.id">
              {{ product.sku }} | {{ product.name }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="rounded-control p-2 text-ink-muted transition-colors hover:bg-state-error/10 hover:text-state-error"
          aria-label="Hapus baris tukar tambah"
          @click="removeLine(index)"
        >
          <BaseIcon name="close" :size="16" />
        </button>
      </div>

      <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-ink-secondary">
            Kuantitas <span class="text-ink-muted">({{ unitOf(line.productId) }})</span>
          </span>
          <input
            v-model.number="line.qty"
            type="number"
            min="1"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-ink-secondary">Nilai tebus per unit</span>
          <input
            v-model.number="line.unitValue"
            type="number"
            min="0"
            step="100"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
      </div>

      <p class="amount mt-2 text-right text-small font-semibold text-ink-primary">
        {{ formatCurrency(line.qty * line.unitValue) }}
      </p>
    </div>

    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-control border border-dashed border-line py-2.5 text-small font-semibold text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
      @click="addLine"
    >
      <BaseIcon name="plus" :size="16" />
      Tambah barang bekas
    </button>

    <label class="flex items-start gap-2.5 rounded-control border border-line px-3 py-2.5">
      <input
        v-model="model.vatable"
        type="checkbox"
        class="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-ink-strong focus:ring-brand/30"
      />
      <span class="text-small text-ink-secondary">
        <span class="font-medium text-ink-primary">Pelanggan PKP</span> | menerbitkan faktur pajak
        atas penyerahan barang bekas, sehingga PPN {{ vatRate }}%-nya menjadi kredit pajak
        perusahaan.
      </span>
    </label>

    <dl class="rounded-control border border-line bg-surface-alt/70 px-4 py-3 text-data">
      <div class="flex justify-between py-1">
        <dt class="text-ink-secondary">Nilai barang bekas (DPP)</dt>
        <dd class="amount text-ink-primary">{{ formatCurrency(dpp) }}</dd>
      </div>
      <div class="flex justify-between py-1">
        <dt class="text-ink-secondary">PPN masukan</dt>
        <dd class="amount text-ink-primary">{{ formatCurrency(ppn) }}</dd>
      </div>
      <div class="flex justify-between border-t border-line py-2">
        <dt class="font-semibold text-ink-primary">Potongan tagihan</dt>
        <dd class="amount font-bold text-ink-primary">{{ formatCurrency(total) }}</dd>
      </div>
      <div class="flex justify-between pt-1">
        <dt class="text-ink-secondary">Sisa yang harus dibayar pelanggan</dt>
        <dd
          class="amount font-bold"
          :class="remaining < 0 ? 'text-state-error' : 'text-ink-primary'"
        >
          {{ formatCurrency(remaining) }}
        </dd>
      </div>
    </dl>

    <p v-if="remaining < 0" class="text-small font-medium text-state-error" role="alert">
      Nilai tukar tambah melebihi total faktur. Kurangi nilainya atau tambah barang yang dijual.
    </p>
  </div>
</template>
