<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import JournalEntryList from '@/components/erp/JournalEntryList.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { CASH_ACCOUNTS } from '@/data/chartOfAccounts'
import { today } from '@/services/clock'
import {
  getSalesInvoiceDetail,
  issueTaxInvoiceNumber,
  postSalesInvoice,
  recordSalesPayment,
} from '@/services/salesService'
import { ROUTE } from '@/router/routeNames'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { Payment, SalesInvoiceDetail } from '@/types'

const props = defineProps<{ id: string }>()

const router = useRouter()
const toast = useToastStore()

const detail = ref<SalesInvoiceDetail | null>(null)
const loading = ref(true)
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = true

  try {
    detail.value = await getSalesInvoiceDetail(props.id)
  } catch {
    toast.push('Faktur tidak ditemukan.', 'error')
    void router.push({ name: ROUTE.sales })
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

/** Nama produk untuk baris mutasi gudang | bisa barang dijual atau barang bekas. */
function productNameOf(productId: string): string {
  const all = [...(detail.value?.lines ?? []), ...(detail.value?.tradeInLines ?? [])]
  return all.find((row) => row.product.id === productId)?.product.name ?? productId
}

const marginPercent = computed(() => {
  if (!detail.value || detail.value.invoice.totals.dpp === 0) return 0
  return (detail.value.margin / detail.value.invoice.totals.dpp) * 100
})

/* -------------------------------------------------------------------------- */
/* Aksi dokumen                                                                */
/* -------------------------------------------------------------------------- */

async function post(): Promise<void> {
  if (!detail.value) return
  busy.value = true

  try {
    await postSalesInvoice(detail.value.invoice.id)
    toast.push('Faktur diposting | stok, jurnal, dan PPN keluaran ikut terbentuk.')
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal memposting faktur.', 'error')
  } finally {
    busy.value = false
  }
}

async function issueTaxNumber(): Promise<void> {
  if (!detail.value) return
  busy.value = true

  try {
    const updated = await issueTaxInvoiceNumber(detail.value.invoice.id)
    toast.push(`Nomor faktur pajak ${updated.taxInvoiceNumber} diterbitkan.`)
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menerbitkan faktur pajak.', 'error')
  } finally {
    busy.value = false
  }
}

/* Pembayaran */
const paymentOpen = ref(false)
const paymentForm = ref({
  date: today(),
  amount: 0,
  accountCode: CASH_ACCOUNTS[1]?.code ?? CASH_ACCOUNTS[0].code,
  method: 'transfer' as Payment['method'],
})

function openPayment(): void {
  if (!detail.value) return
  paymentForm.value = {
    date: today(),
    amount: detail.value.outstanding,
    accountCode: CASH_ACCOUNTS[1]?.code ?? CASH_ACCOUNTS[0].code,
    method: 'transfer',
  }
  paymentOpen.value = true
}

async function submitPayment(): Promise<void> {
  if (!detail.value) return
  busy.value = true

  try {
    await recordSalesPayment({
      invoiceId: detail.value.invoice.id,
      direction: 'in',
      date: paymentForm.value.date,
      amount: paymentForm.value.amount,
      accountCode: paymentForm.value.accountCode,
      method: paymentForm.value.method,
    })

    paymentOpen.value = false
    toast.push('Penerimaan dicatat | kas bertambah, piutang berkurang.')
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal mencatat pembayaran.', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <LoadingState v-if="loading" :rows="6" />

    <template v-else-if="detail">
      <PageHeader
        :title="detail.invoice.number"
        :description="`${detail.customer?.name ?? '|'} · ${formatDate(detail.invoice.date)} · jatuh tempo ${formatDate(detail.invoice.dueDate)}`"
      >
        <template #actions>
          <BaseButton variant="ghost" icon="back" @click="router.push({ name: ROUTE.sales })">
            Kembali
          </BaseButton>
          <BaseButton
            v-if="detail.status === 'draft'"
            icon="check"
            :loading="busy"
            @click="post"
          >
            Posting Faktur
          </BaseButton>
          <BaseButton
            v-else-if="detail.outstanding > 0"
            icon="cash"
            :loading="busy"
            @click="openPayment"
          >
            Catat Pembayaran
          </BaseButton>
        </template>
      </PageHeader>

      <BaseCallout v-if="detail.status === 'draft'" tone="warning" title="Faktur masih draft">
        Dokumen ini belum menyentuh buku: stok belum berkurang, jurnal belum terbentuk, dan PPN-nya
        belum terutang. Semua itu terjadi sekaligus saat Anda menekan “Posting Faktur”.
      </BaseCallout>

      <BaseCallout
        v-else-if="!detail.invoice.taxInvoiceNumber"
        tone="warning"
        title="Faktur pajak belum bernomor"
      >
        PPN keluaran sebesar {{ formatCurrency(detail.invoice.totals.ppn) }} sudah terutang, tetapi
        nomor seri faktur pajaknya belum diterbitkan.
        <button
          type="button"
          class="ml-1 font-semibold underline decoration-brand decoration-2 underline-offset-4"
          @click="issueTaxNumber"
        >
          Terbitkan sekarang
        </button>
      </BaseCallout>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="flex flex-col gap-4 xl:col-span-2">
          <BaseCard title="Rincian Barang" flush>
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-data">
                <thead>
                  <tr class="border-b border-line">
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Produk</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Qty</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Harga</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Disk.</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in detail.lines" :key="row.product.id" class="border-b border-line/70">
                    <td class="px-4 py-3">
                      <span class="font-medium text-ink-primary">{{ row.product.name }}</span>
                      <span class="identifier block">{{ row.product.sku }}</span>
                    </td>
                    <td class="amount px-4 py-3 text-right">
                      {{ formatNumber(row.line.qty) }} {{ row.product.unit }}
                    </td>
                    <td class="amount px-4 py-3 text-right">{{ formatCurrency(row.line.unitPrice) }}</td>
                    <td class="amount px-4 py-3 text-right">
                      {{ row.line.discountPercent > 0 ? formatPercent(row.line.discountPercent) : '|' }}
                    </td>
                    <td class="amount px-4 py-3 text-right font-semibold">{{ formatCurrency(row.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <dl class="border-t border-line px-4 py-3 text-data">
              <div class="flex justify-between py-1">
                <dt class="text-ink-secondary">Bruto</dt>
                <dd class="amount">{{ formatCurrency(detail.invoice.totals.gross) }}</dd>
              </div>
              <div v-if="detail.invoice.totals.discount > 0" class="flex justify-between py-1">
                <dt class="text-ink-secondary">Diskon</dt>
                <dd class="amount">-{{ formatCurrency(detail.invoice.totals.discount) }}</dd>
              </div>
              <div class="flex justify-between py-1">
                <dt class="text-ink-secondary">DPP</dt>
                <dd class="amount">{{ formatCurrency(detail.invoice.totals.dpp) }}</dd>
              </div>
              <div class="flex justify-between py-1">
                <dt class="text-ink-secondary">PPN</dt>
                <dd class="amount">{{ formatCurrency(detail.invoice.totals.ppn) }}</dd>
              </div>
              <div class="mt-1 flex justify-between border-t border-line pt-2">
                <dt class="font-semibold">Total</dt>
                <dd class="amount font-bold">{{ formatCurrency(detail.invoice.totals.total) }}</dd>
              </div>
            </dl>
          </BaseCard>

          <!--
            Tukar tambah disajikan sebagai blok tersendiri, bukan baris diskon,
            supaya jelas bahwa ini penyerahan barang dari pelanggan | lengkap
            dengan konsekuensi PPN masukannya.
          -->
          <BaseCard
            v-if="detail.invoice.tradeIn"
            title="Tukar Tambah"
            subtitle="Barang bekas yang diterima sebagai potongan pembayaran"
            flush
          >
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-data">
                <thead>
                  <tr class="border-b border-line">
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Barang bekas</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Qty</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Nilai tebus</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in detail.tradeInLines" :key="row.product.id" class="border-b border-line/70">
                    <td class="px-4 py-3">
                      <span class="font-medium text-ink-primary">{{ row.product.name }}</span>
                      <span class="identifier block">{{ row.product.sku }}</span>
                    </td>
                    <td class="amount px-4 py-3 text-right">
                      {{ formatNumber(row.line.qty) }} {{ row.product.unit }}
                    </td>
                    <td class="amount px-4 py-3 text-right">{{ formatCurrency(row.line.unitPrice) }}</td>
                    <td class="amount px-4 py-3 text-right font-semibold">{{ formatCurrency(row.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <dl class="border-t border-line px-4 py-3 text-data">
              <div class="flex justify-between py-1">
                <dt class="text-ink-secondary">DPP barang bekas</dt>
                <dd class="amount">{{ formatCurrency(detail.invoice.tradeIn.dpp) }}</dd>
              </div>
              <div class="flex justify-between py-1">
                <dt class="text-ink-secondary">PPN masukan</dt>
                <dd class="amount">{{ formatCurrency(detail.invoice.tradeIn.ppn) }}</dd>
              </div>
              <div class="flex justify-between py-1">
                <dt class="text-ink-secondary">Faktur pajak pelanggan</dt>
                <!--
                  Tiga keadaan berbeda, jangan disamakan: sudah bernomor, PKP
                  tapi fakturnya belum masuk, atau memang tidak wajib faktur.
                -->
                <dd class="identifier">
                  {{
                    detail.invoice.tradeIn.taxInvoiceNumber ??
                    (detail.invoice.tradeIn.ppn > 0 ? 'Menunggu dari pelanggan' : 'Pelanggan non-PKP')
                  }}
                </dd>
              </div>
              <div class="mt-1 flex justify-between border-t border-line pt-2">
                <dt class="font-semibold">Potongan tagihan</dt>
                <dd class="amount font-bold">{{ formatCurrency(detail.invoice.tradeIn.total) }}</dd>
              </div>
            </dl>
          </BaseCard>

          <!-- Bukti integrasi paling gamblang: jurnal yang lahir dari dokumen ini. -->
          <BaseCard
            title="Jurnal Otomatis"
            subtitle="Dibentuk oleh sistem dari faktur ini | tidak diketik manual"
          >
            <EmptyState
              v-if="detail.journal.length === 0"
              title="Belum ada jurnal"
              description="Faktur draft belum dibukukan."
            />
            <JournalEntryList v-else :entries="detail.journal" />
          </BaseCard>
        </div>

        <div class="flex flex-col gap-4">
          <BaseCard title="Status Dokumen">
            <dl class="flex flex-col gap-3 text-data">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Status</dt>
                <dd><BaseBadge :status="detail.status" /></dd>
              </div>
              <div v-if="detail.tradeInValue > 0" class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Potongan tukar tambah</dt>
                <dd class="amount font-semibold">−{{ formatCurrency(detail.tradeInValue) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Sudah dibayar</dt>
                <dd class="amount font-semibold">{{ formatCurrency(detail.invoice.paidAmount) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Sisa tagihan</dt>
                <dd class="amount font-semibold" :class="detail.outstanding > 0 ? 'text-state-warning' : ''">
                  {{ formatCurrency(detail.outstanding) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Laba kotor</dt>
                <dd class="amount font-semibold">
                  {{ formatCurrency(detail.margin) }}
                  <span class="text-xs text-ink-secondary">({{ formatPercent(marginPercent) }})</span>
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Faktur pajak</dt>
                <dd class="identifier">{{ detail.invoice.taxInvoiceNumber ?? 'Belum terbit' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Sales</dt>
                <dd class="text-ink-primary">{{ detail.invoice.salesPerson }}</dd>
              </div>
            </dl>
          </BaseCard>

          <!-- Bisa dua arah: barang dagang keluar, barang bekas justru masuk. -->
          <BaseCard title="Mutasi Gudang" subtitle="Jejak faktur ini di kartu stok" flush>
            <EmptyState
              v-if="detail.stockMoves.length === 0"
              title="Belum ada mutasi stok"
              description="Stok baru bergerak setelah faktur diposting."
            />
            <ul v-else class="divide-y divide-line">
              <li
                v-for="move in detail.stockMoves"
                :key="move.id"
                class="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-data text-ink-primary">{{ productNameOf(move.productId) }}</p>
                  <p class="text-xs text-ink-muted">{{ move.note }}</p>
                </div>
                <span
                  class="amount shrink-0 font-semibold"
                  :class="move.qty < 0 ? 'text-state-error' : 'text-state-success'"
                >
                  {{ move.qty > 0 ? '+' : '' }}{{ formatNumber(move.qty) }}
                </span>
              </li>
            </ul>
          </BaseCard>

          <BaseCard title="Riwayat Pembayaran" flush>
            <EmptyState
              v-if="detail.payments.length === 0"
              title="Belum ada pembayaran"
              description="Penerimaan yang dicatat akan tampil di sini."
            />
            <ul v-else class="divide-y divide-line">
              <li
                v-for="payment in detail.payments"
                :key="payment.id"
                class="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div class="min-w-0">
                  <p class="identifier truncate">{{ payment.number }}</p>
                  <p class="text-xs text-ink-muted">
                    {{ formatDate(payment.date) }} · {{ payment.method }}
                  </p>
                </div>
                <span class="amount shrink-0 font-semibold text-ink-primary">
                  {{ formatCurrency(payment.amount) }}
                </span>
              </li>
            </ul>
          </BaseCard>
        </div>
      </div>

      <IntegrationNote title="Jejak dokumen ini di seluruh sistem">
        {{ detail.warehouse?.name }} mengeluarkan barang senilai
        {{ formatCurrency(detail.invoice.cogs) }} (masuk ke akun 5100 Harga Pokok Penjualan),
        piutang {{ formatCurrency(detail.invoice.totals.total) }} tercatat di akun 1200, dan PPN
        keluaran {{ formatCurrency(detail.invoice.totals.ppn) }} menambah kewajiban pajak di akun
        2200 yang akan muncul pada SPT Masa PPN periode ini.
        <template v-if="detail.invoice.tradeIn">
          Barang bekas yang diterima menambah persediaan di gudang yang sama, memotong piutang
          {{ formatCurrency(detail.invoice.tradeIn.total) }}, dan PPN masukannya
          {{ formatCurrency(detail.invoice.tradeIn.ppn) }} menjadi kredit pajak yang mengurangi PPN
          kurang bayar masa ini.
        </template>
      </IntegrationNote>
    </template>

    <BaseModal
      :open="paymentOpen"
      title="Catat Penerimaan Pembayaran"
      description="Kas/bank bertambah, piutang usaha berkurang."
      @close="paymentOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitPayment">
        <BaseInput v-model="paymentForm.date" label="Tanggal" type="date" required />
        <BaseInput
          v-model.number="paymentForm.amount"
          label="Nilai pembayaran"
          type="number"
          required
          :hint="`Sisa tagihan ${formatCurrency(detail?.outstanding ?? 0)}`"
        />

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">Diterima di</span>
          <select
            v-model="paymentForm.accountCode"
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="account in CASH_ACCOUNTS" :key="account.code" :value="account.code">
              {{ account.code }} | {{ account.name }}
            </option>
          </select>
        </label>

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">Metode</span>
          <select
            v-model="paymentForm.method"
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="transfer">Transfer bank</option>
            <option value="tunai">Tunai</option>
            <option value="giro">Giro</option>
          </select>
        </label>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="paymentOpen = false">Batal</BaseButton>
        <BaseButton :loading="busy" @click="submitPayment">Simpan</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
