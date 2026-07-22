<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ShareList from '@/components/charts/ShareList.vue'
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
import { CASH_ACCOUNTS, EXPENSE_ACCOUNTS } from '@/data/chartOfAccounts'
import { today } from '@/services/clock'
import {
  createExpense,
  getExpenseBreakdown,
  getExpenseRows,
  payExpense,
  WITHHOLDING_LABEL,
  WITHHOLDING_RATE,
} from '@/services/expenseService'
import { getCompanyProfile } from '@/services/masterService'
import { usePeriodStore } from '@/stores/periodStore'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { AccountCode, ExpenseRow, IsoDate, RankedItem, WithholdingType } from '@/types'

const period = usePeriodStore()
const toast = useToastStore()

const rows = ref<ExpenseRow[]>([])
const breakdown = ref<RankedItem[]>([])
const loading = ref(true)

const search = ref('')
const accountFilter = ref<AccountCode | 'all'>('all')

/** Tarif PPN diambil dari profil perusahaan, bukan dituliskan ulang di view. */
const vatRate = ref(11)

const WITHHOLDING_OPTIONS: WithholdingType[] = ['none', 'pph21', 'pph23', 'pph4-2']

async function load(): Promise<void> {
  loading.value = true
  const [rowList, breakdownList, company] = await Promise.all([
    getExpenseRows(period.from, period.to),
    getExpenseBreakdown(period.from, period.to),
    getCompanyProfile(),
  ])
  rows.value = rowList
  breakdown.value = breakdownList
  vatRate.value = company.vatRate
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return rows.value.filter((row) => {
    if (accountFilter.value !== 'all' && row.expense.accountCode !== accountFilter.value) return false
    if (!term) return true
    return (
      row.expense.description.toLowerCase().includes(term) ||
      row.expense.vendor.toLowerCase().includes(term) ||
      row.expense.number.toLowerCase().includes(term)
    )
  })
})

const summary = computed(() => {
  const unpaid = rows.value.filter((row) => row.expense.status === 'posted')
  return {
    total: rows.value.reduce((sum, row) => sum + row.expense.amount, 0),
    unpaid: unpaid.reduce((sum, row) => sum + row.cashOut, 0),
    unpaidCount: unpaid.length,
    withholding: rows.value.reduce((sum, row) => sum + row.expense.withholdingAmount, 0),
    vatIn: rows.value.reduce((sum, row) => sum + row.expense.ppn, 0),
  }
})

const columns: TableColumn<ExpenseRow>[] = [
  { key: 'number', label: 'No. Bukti' },
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.expense.date) },
  { key: 'description', label: 'Keterangan' },
  { key: 'account', label: 'Akun' },
  { key: 'amount', label: 'Nilai', align: 'right' },
  { key: 'ppn', label: 'PPN', align: 'right' },
  { key: 'withholding', label: 'PPh Dipotong', align: 'right' },
  { key: 'cashOut', label: 'Kas Keluar', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

/* -------------------------------------------------------------------------- */
/* Pelunasan beban terutang                                                    */
/* -------------------------------------------------------------------------- */

const payOpen = ref(false)
const paying = ref(false)
const payTarget = ref<ExpenseRow | null>(null)
const payForm = ref<{ date: IsoDate; accountCode: AccountCode }>({
  date: today(),
  accountCode: CASH_ACCOUNTS[0].code,
})

function openPay(row: ExpenseRow): void {
  payTarget.value = row
  payForm.value = { date: today(), accountCode: CASH_ACCOUNTS[1]?.code ?? CASH_ACCOUNTS[0].code }
  payOpen.value = true
}

async function submitPay(): Promise<void> {
  const target = payTarget.value
  if (!target) return
  paying.value = true

  try {
    await payExpense(target.expense.id, payForm.value.accountCode, payForm.value.date)
    payOpen.value = false
    toast.push(`Beban ${target.expense.number} dilunasi | jurnal kas keluar terbentuk.`)
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal melunasi beban.', 'error')
  } finally {
    paying.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Form beban baru                                                             */
/* -------------------------------------------------------------------------- */

const formOpen = ref(false)
const saving = ref(false)

/** String kosong = beban diakui dulu sebagai utang (belum dibayar). */
const form = ref({
  date: today(),
  accountCode: EXPENSE_ACCOUNTS[0].code,
  description: '',
  vendor: '',
  amount: 0,
  creditableVat: false,
  withholding: 'none' as WithholdingType,
  paidFromAccount: '' as AccountCode | '',
})

const formAmount = computed(() => Number(form.value.amount) || 0)

const formPpn = computed(() =>
  form.value.creditableVat ? Math.round((formAmount.value * vatRate.value) / 100) : 0,
)

const formWithholding = computed(() =>
  Math.round((formAmount.value * WITHHOLDING_RATE[form.value.withholding]) / 100),
)

const formCashOut = computed(() => formAmount.value + formPpn.value - formWithholding.value)

function openForm(): void {
  form.value = {
    date: today(),
    accountCode: EXPENSE_ACCOUNTS[0].code,
    description: '',
    vendor: '',
    amount: 0,
    creditableVat: false,
    withholding: 'none',
    paidFromAccount: CASH_ACCOUNTS[1]?.code ?? CASH_ACCOUNTS[0].code,
  }
  formOpen.value = true
}

async function submitForm(): Promise<void> {
  saving.value = true

  try {
    const created = await createExpense({
      date: form.value.date,
      accountCode: form.value.accountCode,
      description: form.value.description,
      amount: formAmount.value,
      ppn: formPpn.value,
      withholding: form.value.withholding,
      paidFromAccount: form.value.paidFromAccount === '' ? null : form.value.paidFromAccount,
      vendor: form.value.vendor,
    })

    formOpen.value = false
    toast.push(`Beban ${created.number} tercatat dan langsung masuk buku.`)
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menyimpan beban.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Beban Operasional"
      :description="`Beban periode ${period.label}. Setiap beban terikat ke akun bagan akun, PPN dan PPh-nya langsung mengalir ke Perpajakan.`"
    >
      <template #actions>
        <BaseButton icon="plus" @click="openForm">Catat Beban</BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Beban"
          :value="formatCurrency(summary.total)"
          icon="expense"
          tone="brand"
          :caption="`${rows.length} bukti beban`"
        />
        <StatCard
          label="Beban Belum Dibayar"
          :value="formatCurrency(summary.unpaid)"
          icon="alert"
          :tone="summary.unpaid > 0 ? 'warning' : 'plain'"
          :caption="`${summary.unpaidCount} bukti masih terutang`"
        />
        <StatCard
          label="PPh Dipotong"
          :value="formatCurrency(summary.withholding)"
          icon="percent"
          caption="Menjadi utang pajak di Neraca"
        />
        <StatCard
          label="PPN Masukan dari Beban"
          :value="formatCurrency(summary.vatIn)"
          icon="tax"
          caption="Kredit pajak di SPT Masa PPN"
        />
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <BaseCard flush class="xl:col-span-2">
          <template #header>
            <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <label class="relative flex min-w-0 flex-1 items-center">
                <span class="sr-only">Cari beban</span>
                <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
                <input
                  v-model="search"
                  type="search"
                  placeholder="Cari keterangan, vendor, atau nomor bukti…"
                  class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <select
                v-model="accountFilter"
                class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="all">Semua akun beban</option>
                <option v-for="account in EXPENSE_ACCOUNTS" :key="account.code" :value="account.code">
                  {{ account.code }} | {{ account.name }}
                </option>
              </select>
            </div>
          </template>

          <BaseTable :columns="columns" :rows="filtered" :row-key="(row) => row.expense.id">
            <template #cell-number="{ row }">
              <span class="identifier">{{ row.expense.number }}</span>
            </template>

            <template #cell-description="{ row }">
              <span class="font-medium text-ink-primary">{{ row.expense.description }}</span>
              <span class="block text-xs text-ink-muted">{{ row.expense.vendor }}</span>
            </template>

            <template #cell-account="{ row }">
              <span class="identifier">{{ row.expense.accountCode }}</span>
              <span class="block text-xs text-ink-muted">{{ row.accountName }}</span>
            </template>

            <template #cell-amount="{ row }">
              <span class="amount font-semibold">{{ formatCurrency(row.expense.amount) }}</span>
            </template>

            <template #cell-ppn="{ row }">
              <span class="amount">
                {{ row.expense.ppn > 0 ? formatCurrency(row.expense.ppn) : '|' }}
              </span>
            </template>

            <template #cell-withholding="{ row }">
              <span class="amount">
                {{ row.expense.withholdingAmount > 0 ? formatCurrency(row.expense.withholdingAmount) : '|' }}
              </span>
              <span v-if="row.expense.withholding !== 'none'" class="block text-xs text-ink-muted">
                {{ WITHHOLDING_LABEL[row.expense.withholding] }}
              </span>
            </template>

            <template #cell-cashOut="{ row }">
              <span class="amount">{{ formatCurrency(row.cashOut) }}</span>
            </template>

            <template #cell-status="{ row }">
              <!-- 'posted' pada beban berarti sudah dibukukan tapi belum dibayar. -->
              <BaseBadge
                :status="row.expense.status"
                :label="row.expense.status === 'posted' ? 'Belum Dibayar' : 'Dibayar'"
              />
            </template>

            <template #cell-actions="{ row }">
              <BaseButton
                v-if="row.expense.status === 'posted'"
                size="sm"
                variant="secondary"
                icon="cash"
                @click="openPay(row)"
              >
                Bayar
              </BaseButton>
              <span v-else class="text-xs text-ink-muted">
                {{ formatDate(row.expense.settlement?.date ?? row.expense.date) }}
              </span>
            </template>

            <template #empty>
              <div class="px-4 pb-4">
                <EmptyState
                  title="Belum ada beban pada periode ini"
                  description="Ubah filter periode di topbar, atau catat beban baru."
                />
              </div>
            </template>
          </BaseTable>
        </BaseCard>

        <BaseCard title="Komposisi Beban" subtitle="Porsi tiap akun terhadap total beban periode">
          <ShareList v-if="breakdown.length > 0" :items="breakdown" />
          <EmptyState v-else title="Belum ada komposisi" description="Belum ada beban yang tercatat." />
        </BaseCard>
      </div>

      <IntegrationNote title="Beban tidak berhenti di halaman ini">
        Tiap beban terikat langsung ke akun <strong>bagan akun</strong>, jadi angkanya muncul apa
        adanya sebagai Beban Operasional di <strong>Laba Rugi</strong>. PPN-nya menjadi kredit pajak
        di <strong>Perpajakan</strong>, PPh yang dipotong menjadi utang pajak di
        <strong>Neraca</strong>, dan beban yang belum dibayar mengendap di akun
        <span class="identifier">2300</span> Beban Masih Harus Dibayar sampai dilunasi.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="payOpen"
      title="Bayar Beban"
      :description="payTarget ? `${payTarget.expense.number} · ${payTarget.expense.description}` : ''"
      @close="payOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitPay">
        <div v-if="payTarget" class="rounded-control border border-line bg-surface-alt px-4 py-3">
          <p class="text-small text-ink-secondary">Kas yang keluar</p>
          <p class="amount mt-1 text-h3 text-ink-primary">{{ formatCurrency(payTarget.cashOut) }}</p>
          <p class="mt-1 text-xs text-ink-muted">
            Nilai beban + PPN dikurangi PPh yang dipotong dari rekanan.
          </p>
        </div>

        <BaseInput v-model="payForm.date" label="Tanggal bayar" type="date" required />

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">Dibayar dari</span>
          <select
            v-model="payForm.accountCode"
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="account in CASH_ACCOUNTS" :key="account.code" :value="account.code">
              {{ account.code }} | {{ account.name }}
            </option>
          </select>
        </label>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="payOpen = false">Batal</BaseButton>
        <BaseButton :loading="paying" @click="submitPay">Bayar Sekarang</BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="formOpen"
      title="Catat Beban"
      description="Beban langsung dibukukan | tidak ada tahap draft."
      @close="formOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitForm">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.date" label="Tanggal" type="date" required />

          <label class="flex w-full flex-col gap-2">
            <span class="text-sm font-medium text-ink-secondary">
              Akun beban <span class="text-state-error">*</span>
            </span>
            <select
              v-model="form.accountCode"
              required
              class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="account in EXPENSE_ACCOUNTS" :key="account.code" :value="account.code">
                {{ account.code }} | {{ account.name }}
              </option>
            </select>
          </label>
        </div>

        <BaseInput v-model="form.description" label="Keterangan" required placeholder="Mis. Sewa gudang Juli" />
        <BaseInput v-model="form.vendor" label="Vendor / rekanan" required placeholder="Mis. CV Griya Sentosa" />
        <BaseInput v-model="form.amount" label="Nilai beban" type="number" :min="0" required />

        <label class="flex items-start gap-3 rounded-control border border-line bg-surface-alt px-4 py-3">
          <input
            v-model="form.creditableVat"
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-line accent-brand"
          />
          <span class="min-w-0">
            <span class="block text-data font-medium text-ink-primary">
              PPN masukan {{ vatRate }}% dapat dikreditkan
            </span>
            <span class="block text-xs text-ink-muted">
              Centang bila vendor PKP dan faktur pajaknya diterima |
              <span class="amount">{{ formatCurrency(formPpn) }}</span>
            </span>
          </span>
        </label>

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">Potongan PPh</span>
          <select
            v-model="form.withholding"
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="type in WITHHOLDING_OPTIONS" :key="type" :value="type">
              {{ WITHHOLDING_LABEL[type] }}
            </option>
          </select>
          <span class="text-xs text-ink-muted">
            Dipotong dari pembayaran ke rekanan:
            <span class="amount">{{ formatCurrency(formWithholding) }}</span>
            ({{ WITHHOLDING_RATE[form.withholding] }}%)
          </span>
        </label>

        <label class="flex w-full flex-col gap-2">
          <span class="text-sm font-medium text-ink-secondary">Dibayar dari</span>
          <select
            v-model="form.paidFromAccount"
            class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option v-for="account in CASH_ACCOUNTS" :key="account.code" :value="account.code">
              {{ account.code }} | {{ account.name }}
            </option>
            <option value="">Belum dibayar (akui sebagai utang)</option>
          </select>
        </label>

        <div class="rounded-control border border-line bg-surface-alt px-4 py-3">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-small text-ink-secondary">Kas keluar</span>
            <span class="amount text-data font-semibold text-ink-primary">
              {{ form.paidFromAccount === '' ? '|' : formatCurrency(formCashOut) }}
            </span>
          </div>
          <p class="mt-1 text-xs text-ink-muted">
            {{
              form.paidFromAccount === ''
                ? 'Beban diakui sekarang dan masuk akun 2300 Beban Masih Harus Dibayar.'
                : 'Nilai beban + PPN dikurangi PPh yang dipotong.'
            }}
          </p>
        </div>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Batal</BaseButton>
        <BaseButton
          :loading="saving"
          :disabled="formAmount <= 0 || form.description.trim() === ''"
          @click="submitForm"
        >
          Simpan Beban
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
