<script setup lang="ts">
import { computed } from 'vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import { calcTotals, lineAmount } from '@/utils/documentTotals'
import { formatCurrency } from '@/utils/formatCurrency'
import type { DocumentLine, Product } from '@/types'

/**
 * Penyunting baris barang untuk faktur penjualan & pembelian.
 *
 * Total, DPP, dan PPN TIDAK bisa diketik | semuanya dihitung ulang dari baris
 * lewat `calcTotals()`, fungsi yang sama yang dipakai service saat menyimpan.
 * Jadi yang dilihat user saat mengisi form persis sama dengan yang dibukukan.
 */
const props = defineProps<{
  products: Product[]
  vatRate: number
  /** `price` untuk penjualan, `cost` untuk pembelian. */
  priceField: 'price' | 'cost'
}>()

const lines = defineModel<DocumentLine[]>({ required: true })

const productById = computed(() => new Map(props.products.map((product) => [product.id, product])))

const totals = computed(() => calcTotals(lines.value, props.vatRate))

function addLine(): void {
  const first = props.products[0]
  if (!first) return

  lines.value = [
    ...lines.value,
    { productId: first.id, qty: 1, unitPrice: first[props.priceField], discountPercent: 0 },
  ]
}

function removeLine(index: number): void {
  lines.value = lines.value.filter((_, position) => position !== index)
}

/** Ganti produk = harga satuannya ikut menyesuaikan master, bukan tertinggal. */
function onProductChange(index: number, productId: string): void {
  const product = productById.value.get(productId)
  if (!product) return

  lines.value = lines.value.map((line, position) =>
    position === index ? { ...line, productId, unitPrice: product[props.priceField] } : line,
  )
}

function unitOf(productId: string): string {
  return productById.value.get(productId)?.unit ?? ''
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="rounded-control border border-line bg-surface-alt/50 p-3"
    >
      <div class="flex items-start gap-2">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Produk</span>
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
          aria-label="Hapus baris"
          @click="removeLine(index)"
        >
          <BaseIcon name="close" :size="16" />
        </button>
      </div>

      <div class="mt-2 grid grid-cols-3 gap-2">
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
          <span class="text-xs font-medium text-ink-secondary">Harga satuan</span>
          <input
            v-model.number="line.unitPrice"
            type="number"
            min="0"
            step="1000"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-ink-secondary">Diskon (%)</span>
          <input
            v-model.number="line.discountPercent"
            type="number"
            min="0"
            max="100"
            step="0.5"
            class="w-full rounded-control border border-line bg-surface px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
      </div>

      <p class="amount mt-2 text-right text-small font-semibold text-ink-primary">
        {{ formatCurrency(lineAmount(line)) }}
      </p>
    </div>

    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-control border border-dashed border-line py-2.5 text-small font-semibold text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
      @click="addLine"
    >
      <BaseIcon name="plus" :size="16" />
      Tambah baris barang
    </button>

    <!-- Ringkasan nilai: bukti bahwa DPP & PPN turunan baris, bukan input. -->
    <dl class="rounded-control border border-line bg-surface-alt/70 px-4 py-3 text-data">
      <div class="flex justify-between py-1">
        <dt class="text-ink-secondary">Jumlah bruto</dt>
        <dd class="amount text-ink-primary">{{ formatCurrency(totals.gross) }}</dd>
      </div>
      <div v-if="totals.discount > 0" class="flex justify-between py-1">
        <dt class="text-ink-secondary">Diskon</dt>
        <dd class="amount text-ink-primary">-{{ formatCurrency(totals.discount) }}</dd>
      </div>
      <div class="flex justify-between py-1">
        <dt class="text-ink-secondary">Dasar Pengenaan Pajak</dt>
        <dd class="amount text-ink-primary">{{ formatCurrency(totals.dpp) }}</dd>
      </div>
      <div class="flex justify-between py-1">
        <dt class="text-ink-secondary">PPN {{ vatRate }}%</dt>
        <dd class="amount text-ink-primary">{{ formatCurrency(totals.ppn) }}</dd>
      </div>
      <div class="mt-1 flex justify-between border-t border-line pt-2">
        <dt class="font-semibold text-ink-primary">Total faktur</dt>
        <dd class="amount font-bold text-ink-primary">{{ formatCurrency(totals.total) }}</dd>
      </div>
    </dl>
  </div>
</template>
