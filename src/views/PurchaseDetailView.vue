<script setup lang="ts">
import { ref, watch } from 'vue'
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
import { getPurchaseInvoiceDetail, recordPurchasePayment } from '@/services/purchaseService'
import { ROUTE } from '@/router/routeNames'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { Payment, PurchaseInvoiceDetail } from '@/types'
import { EMPTY } from '@/utils/placeholder'

const props = defineProps<{ id: string }>()

const router = useRouter()
const toast = useToastStore()

const detail = ref<PurchaseInvoiceDetail | null>(null)
const loading = ref(true)
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = true

  try {
    detail.value = await getPurchaseInvoiceDetail(props.id)
  } catch {
    toast.push('Faktur pembelian tidak ditemukan.', 'error')
    void router.push({ name: ROUTE.purchases })
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

/** Nama produk untuk baris mutasi stok | ambil dari baris faktur yang sama. */
function productNameOf(productId: string): string {
  return detail.value?.lines.find((row) => row.product.id === productId)?.product.name ?? EMPTY
}

/* Pembayaran ke pemasok */
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
    await recordPurchasePayment({
      invoiceId: detail.value.invoice.id,
      direction: 'out',
      date: paymentForm.value.date,
      amount: paymentForm.value.amount,
      accountCode: paymentForm.value.accountCode,
      method: paymentForm.value.method,
    })

    paymentOpen.value = false
    toast.push('Pembayaran dicatat — kas berkurang, utang usaha ikut turun.')
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
        :description="`${detail.supplier?.name ?? EMPTY} · ${formatDate(detail.invoice.date)} · jatuh tempo ${formatDate(detail.invoice.dueDate)}`"
      >
        <template #actions>
          <BaseButton variant="ghost" icon="back" @click="router.push({ name: ROUTE.purchases })">
            Kembali
          </BaseButton>
          <BaseButton v-if="detail.outstanding > 0" icon="cash" :loading="busy" @click="openPayment">
            Catat Pembayaran
          </BaseButton>
        </template>
      </PageHeader>

      <BaseCallout v-if="detail.status === 'overdue'" tone="warning" title="Utang lewat jatuh tempo">
        Faktur ini sudah {{ detail.overdueDays }} hari melewati tanggal jatuh tempo dengan sisa utang
        {{ formatCurrency(detail.outstanding) }}. Nilainya masih tercatat di akun 2100 Utang Usaha.
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
                    <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Harga Beli</th>
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
                      {{ row.line.discountPercent > 0 ? formatPercent(row.line.discountPercent) : EMPTY }}
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
                <dt class="text-ink-secondary">PPN Masukan</dt>
                <dd class="amount">{{ formatCurrency(detail.invoice.totals.ppn) }}</dd>
              </div>
              <div class="mt-1 flex justify-between border-t border-line pt-2">
                <dt class="font-semibold">Total</dt>
                <dd class="amount font-bold">{{ formatCurrency(detail.invoice.totals.total) }}</dd>
              </div>
            </dl>
          </BaseCard>

          <!-- Bukti integrasi paling gamblang: jurnal yang lahir dari dokumen ini. -->
          <BaseCard
            title="Jurnal Otomatis"
            subtitle="Dibentuk sistem dari faktur ini — tidak diketik manual"
          >
            <EmptyState
              v-if="detail.journal.length === 0"
              title="Belum ada jurnal"
              description="Faktur ini belum dibukukan."
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
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Sudah dibayar</dt>
                <dd class="amount font-semibold">{{ formatCurrency(detail.invoice.paidAmount) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Sisa utang</dt>
                <dd
                  class="amount font-semibold"
                  :class="detail.outstanding > 0 ? 'text-state-warning' : ''"
                >
                  {{ formatCurrency(detail.outstanding) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Faktur pajak masukan</dt>
                <dd class="identifier">{{ detail.invoice.taxInvoiceNumber ?? 'Belum diterima' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Termin</dt>
                <dd class="text-ink-primary">
                  Net {{ detail.supplier?.paymentTermDays ?? 0 }} hari
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-secondary">Gudang penerima</dt>
                <dd class="text-ink-primary">{{ detail.warehouse?.name ?? EMPTY }}</dd>
              </div>
            </dl>
          </BaseCard>

          <BaseCard title="Barang Masuk" subtitle="Mutasi di kartu stok gudang" flush>
            <EmptyState
              v-if="detail.stockMoves.length === 0"
              title="Belum ada penerimaan barang"
              description="Mutasi stok akan muncul begitu faktur tercatat."
            />
            <ul v-else class="divide-y divide-line">
              <li
                v-for="move in detail.stockMoves"
                :key="move.id"
                class="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-data text-ink-primary">{{ productNameOf(move.productId) }}</p>
                  <p class="text-xs text-ink-muted">{{ detail.warehouse?.name }}</p>
                </div>
                <span class="amount shrink-0 font-semibold text-state-success">
                  +{{ formatNumber(move.qty) }}
                </span>
              </li>
            </ul>
          </BaseCard>

          <BaseCard title="Riwayat Pembayaran" flush>
            <EmptyState
              v-if="detail.payments.length === 0"
              title="Belum ada pembayaran"
              description="Pembayaran ke pemasok akan tampil di sini."
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
        Gudang {{ detail.warehouse?.name ?? EMPTY }} menerima barang senilai
        {{ formatCurrency(detail.invoice.totals.dpp) }} yang menambah akun 1300 Persediaan | nilai
        itulah yang kelak keluar sebagai harga pokok saat barangnya terjual. Utang ke
        {{ detail.supplier?.name ?? 'pemasok' }} sebesar
        {{ formatCurrency(detail.invoice.totals.total) }} tercatat di akun 2100, dan PPN masukan
        {{ formatCurrency(detail.invoice.totals.ppn) }} pada akun 1400 dapat dikreditkan di SPT Masa
        PPN periode ini.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="paymentOpen"
      title="Catat Pembayaran ke Pemasok"
      description="Kas/bank berkurang, utang usaha ikut turun."
      @close="paymentOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitPayment">
        <BaseInput v-model="paymentForm.date" label="Tanggal" type="date" required />
        <BaseInput
          v-model.number="paymentForm.amount"
          label="Nilai pembayaran"
          type="number"
          required
          :hint="`Sisa utang ${formatCurrency(detail?.outstanding ?? 0)}`"
        />

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">Dibayar dari</span>
          <select
            v-model="paymentForm.accountCode"
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="account in CASH_ACCOUNTS" :key="account.code" :value="account.code">
              {{ account.code }} — {{ account.name }}
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
