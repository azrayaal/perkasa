<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import JournalEntryList from '@/components/erp/JournalEntryList.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseIcon from '@/components/ui/BaseIcon.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import type { TabItem } from '@/components/ui/BaseTabs.types'
import { CHART_OF_ACCOUNTS } from '@/data/chartOfAccounts'
import { today } from '@/services/clock'
import {
  createManualJournal,
  getJournalEntries,
  getJournalSummary,
  SOURCE_LABEL,
  type JournalSummary,
} from '@/services/journalService'
import { getActiveLedgerAccounts, getTrialBalance } from '@/services/ledgerService'
import { usePeriodStore } from '@/stores/periodStore'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type {
  AccountCode,
  JournalEntry,
  JournalSource,
  LedgerAccount,
  LedgerRow,
  TrialBalance,
  TrialBalanceRow,
} from '@/types'
import { EMPTY } from '@/utils/placeholder'

const period = usePeriodStore()
const toast = useToastStore()

const loading = ref(true)
const activeTab = ref('umum')

const summary = ref<JournalSummary | null>(null)
const entries = ref<JournalEntry[]>([])
const ledgers = ref<LedgerAccount[]>([])
const trialBalance = ref<TrialBalance | null>(null)

const sourceFilter = ref<JournalSource | 'all'>('all')
const search = ref('')
const selectedAccount = ref<AccountCode>(CHART_OF_ACCOUNTS[0].code)

/** Jurnal panjang dipotong di UI, tetapi jumlah yang disembunyikan tetap diberitahukan. */
const ENTRY_LIMIT = 40

const SOURCE_OPTIONS: Array<{ value: JournalSource | 'all'; label: string }> = [
  { value: 'all', label: 'Semua modul' },
  ...(Object.keys(SOURCE_LABEL) as JournalSource[]).map((source) => ({
    value: source,
    label: SOURCE_LABEL[source],
  })),
]

async function loadEntries(): Promise<void> {
  entries.value = await getJournalEntries({
    from: period.from,
    to: period.to,
    source: sourceFilter.value === 'all' ? null : sourceFilter.value,
    search: search.value,
  })
}

async function load(): Promise<void> {
  loading.value = true

  const [summaryData, ledgerList, trialBalanceData] = await Promise.all([
    getJournalSummary(period.from, period.to),
    getActiveLedgerAccounts(period.from, period.to),
    getTrialBalance(period.from, period.to),
    loadEntries(),
  ])

  summary.value = summaryData
  ledgers.value = ledgerList
  trialBalance.value = trialBalanceData

  // Akun terpilih dipertahankan selama masih aktif di periode baru.
  if (!ledgerList.some((ledger) => ledger.account.code === selectedAccount.value)) {
    selectedAccount.value = ledgerList[0]?.account.code ?? CHART_OF_ACCOUNTS[0].code
  }

  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })
watch([sourceFilter, search], loadEntries)

const tabs = computed<TabItem[]>(() => [
  { key: 'umum', label: 'Jurnal Umum', count: entries.value.length },
  { key: 'besar', label: 'Buku Besar', count: ledgers.value.length },
  { key: 'neraca-saldo', label: 'Neraca Saldo', count: trialBalance.value?.rows.length ?? 0 },
])

const visibleEntries = computed(() => entries.value.slice(0, ENTRY_LIMIT))
const hiddenEntryCount = computed(() => Math.max(entries.value.length - ENTRY_LIMIT, 0))

const selectedLedger = computed<LedgerAccount | null>(
  () => ledgers.value.find((ledger) => ledger.account.code === selectedAccount.value) ?? null,
)

const ledgerColumns: TableColumn<LedgerRow>[] = [
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.date) },
  { key: 'number', label: 'No. Jurnal' },
  { key: 'description', label: 'Keterangan' },
  { key: 'source', label: 'Sumber' },
  { key: 'debit', label: 'Debit', align: 'right' },
  { key: 'credit', label: 'Kredit', align: 'right' },
  { key: 'balance', label: 'Saldo', align: 'right' },
]

const trialColumns: TableColumn<TrialBalanceRow>[] = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama Akun' },
  { key: 'opening', label: 'Saldo Awal (D/K)', align: 'right' },
  { key: 'mutation', label: 'Mutasi (D/K)', align: 'right' },
  { key: 'ending', label: 'Saldo Akhir (D/K)', align: 'right' },
]

/* -------------------------------------------------------------------------- */
/* Jurnal manual                                                               */
/* -------------------------------------------------------------------------- */

interface ManualLineForm {
  accountCode: AccountCode
  debit: number
  credit: number
}

const formOpen = ref(false)
const saving = ref(false)

const form = ref({ date: today(), description: '' })
const formLines = ref<ManualLineForm[]>([])

function emptyLine(): ManualLineForm {
  return { accountCode: CHART_OF_ACCOUNTS[0].code, debit: 0, credit: 0 }
}

function openForm(): void {
  form.value = { date: today(), description: '' }
  formLines.value = [emptyLine(), emptyLine()]
  formOpen.value = true
}

function addLine(): void {
  formLines.value = [...formLines.value, emptyLine()]
}

function removeLine(index: number): void {
  // Dua baris adalah minimum sebuah jurnal | di bawah itu bukan jurnal lagi.
  if (formLines.value.length <= 2) return
  formLines.value = formLines.value.filter((_, position) => position !== index)
}

const formTotals = computed(() => {
  const debit = formLines.value.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
  const credit = formLines.value.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
  return { debit, credit, difference: debit - credit }
})

const formUsableLines = computed(() =>
  formLines.value.filter((line) => (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0),
)

const formValid = computed(
  () =>
    formUsableLines.value.length >= 2 &&
    formTotals.value.difference === 0 &&
    formTotals.value.debit > 0 &&
    form.value.description.trim() !== '',
)

async function submitForm(): Promise<void> {
  saving.value = true

  try {
    const created = await createManualJournal({
      date: form.value.date,
      description: form.value.description,
      lines: formUsableLines.value.map((line) => ({
        accountCode: line.accountCode,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        memo: form.value.description,
      })),
    })

    formOpen.value = false
    toast.push(`Jurnal manual ${created.number} tersimpan dan langsung masuk buku besar.`)
    await load()
  } catch (caught) {
    toast.push(caught instanceof Error ? caught.message : 'Gagal menyimpan jurnal manual.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Pembukuan"
      :description="`Jurnal umum, buku besar, dan neraca saldo periode ${period.label}. Semuanya diturunkan dari dokumen di modul operasional.`"
    >
      <template #actions>
        <BaseButton icon="plus" @click="openForm">Jurnal Manual</BaseButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading || !summary || !trialBalance" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jumlah Jurnal"
          :value="String(summary.entryCount)"
          icon="journal"
          tone="brand"
          caption="Entri pada periode berjalan"
        />
        <StatCard
          label="Total Debit"
          :value="formatCurrency(summary.totalDebit)"
          icon="trendUp"
          caption="Seluruh baris debit periode ini"
        />
        <StatCard
          label="Total Kredit"
          :value="formatCurrency(summary.totalCredit)"
          icon="trendDown"
          caption="Seluruh baris kredit periode ini"
        />
        <StatCard
          label="Selisih"
          :value="formatCurrency(Math.abs(summary.difference))"
          icon="balance"
          :tone="summary.difference === 0 ? 'success' : 'error'"
          :caption="summary.difference === 0 ? 'Debit dan kredit bertemu' : 'Periksa jurnal manual terakhir'"
        />
      </div>

      <BaseCard flush>
        <template #header>
          <div class="flex w-full flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-h3 text-ink-primary">Buku Perusahaan</h2>
              <p class="mt-1 text-small text-ink-secondary">
                Satu sumber angka untuk neraca, laba rugi, dan arus kas.
              </p>
            </div>
            <BaseBadge :status="summary.difference === 0 ? 'balanced' : 'unbalanced'" />
          </div>
        </template>

        <div class="px-4">
          <BaseTabs v-model="activeTab" :tabs="tabs" />
        </div>

        <!-- Jurnal Umum -->
        <div v-if="activeTab === 'umum'" class="flex flex-col gap-4 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label class="relative flex min-w-0 flex-1 items-center">
              <span class="sr-only">Cari jurnal</span>
              <BaseIcon name="search" :size="16" class="absolute left-3 text-ink-muted" />
              <input
                v-model="search"
                type="search"
                placeholder="Cari nomor jurnal, dokumen, keterangan, atau kode akun…"
                class="w-full rounded-control border border-line bg-surface-alt py-2 pl-9 pr-3 text-data text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <select
              v-model="sourceFilter"
              class="rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option v-for="option in SOURCE_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <JournalEntryList v-if="entries.length > 0" :entries="visibleEntries" />

          <EmptyState
            v-else
            title="Tidak ada jurnal yang cocok"
            description="Longgarkan pencarian atau pilih modul lain."
          />

          <p v-if="hiddenEntryCount > 0" class="text-small text-ink-secondary">
            Menampilkan {{ visibleEntries.length }} dari {{ entries.length }} entri —
            {{ hiddenEntryCount }} entri lainnya tidak ditampilkan. Persempit rentang periode atau
            gunakan pencarian untuk melihatnya.
          </p>
        </div>

        <!-- Buku Besar -->
        <div v-else-if="activeTab === 'besar'" class="flex flex-col gap-4 pt-4">
          <div class="px-4">
            <label class="flex w-full flex-col gap-2 sm:max-w-md">
              <span class="text-sm font-medium text-ink-secondary">Akun</span>
              <select
                v-model="selectedAccount"
                class="w-full rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option v-for="ledger in ledgers" :key="ledger.account.code" :value="ledger.account.code">
                  {{ ledger.account.code }} — {{ ledger.account.name }}
                </option>
              </select>
            </label>
          </div>

          <template v-if="selectedLedger">
            <div class="px-4">
              <div class="flex flex-wrap items-baseline justify-between gap-3 rounded-control border border-line bg-surface-alt px-4 py-3">
                <span class="text-small text-ink-secondary">
                  Saldo awal per {{ formatDate(period.from) }}
                </span>
                <span class="amount text-data font-semibold text-ink-primary">
                  {{ formatCurrency(selectedLedger.openingBalance) }}
                </span>
              </div>
            </div>

            <BaseTable
              :columns="ledgerColumns"
              :rows="selectedLedger.rows"
              :row-key="(row) => `${row.entryId}-${row.number}-${row.balance}`"
            >
              <template #cell-number="{ row }">
                <span class="identifier">{{ row.number }}</span>
              </template>

              <template #cell-description="{ row }">
                <span class="text-ink-primary">{{ row.description }}</span>
              </template>

              <template #cell-source="{ row }">
                <BaseBadge :status="row.source" />
              </template>

              <template #cell-debit="{ row }">
                <span class="amount">{{ row.debit > 0 ? formatCurrency(row.debit) : EMPTY }}</span>
              </template>

              <template #cell-credit="{ row }">
                <span class="amount">{{ row.credit > 0 ? formatCurrency(row.credit) : EMPTY }}</span>
              </template>

              <template #cell-balance="{ row }">
                <span class="amount font-semibold">{{ formatCurrency(row.balance) }}</span>
              </template>

              <template #empty>
                <div class="px-4 pb-4">
                  <EmptyState
                    title="Tidak ada mutasi"
                    description="Akun ini tidak bergerak pada periode berjalan."
                  />
                </div>
              </template>
            </BaseTable>

            <div class="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-3">
              <div class="rounded-control border border-line px-4 py-3">
                <p class="text-small text-ink-secondary">Total debit</p>
                <p class="amount mt-1 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(selectedLedger.totalDebit) }}
                </p>
              </div>
              <div class="rounded-control border border-line px-4 py-3">
                <p class="text-small text-ink-secondary">Total kredit</p>
                <p class="amount mt-1 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(selectedLedger.totalCredit) }}
                </p>
              </div>
              <div class="rounded-control border border-line bg-surface-alt px-4 py-3">
                <p class="text-small text-ink-secondary">Saldo akhir</p>
                <p class="amount mt-1 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(selectedLedger.closingBalance) }}
                </p>
              </div>
            </div>
          </template>

          <div v-else class="px-4 pb-4">
            <EmptyState
              title="Belum ada akun yang bergerak"
              description="Tidak ada akun bersaldo maupun bermutasi pada periode ini."
            />
          </div>
        </div>

        <!-- Neraca Saldo -->
        <div v-else class="flex flex-col gap-4 pt-4">
          <BaseTable
            :columns="trialColumns"
            :rows="trialBalance.rows"
            :row-key="(row) => row.account.code"
          >
            <template #cell-code="{ row }">
              <span class="identifier">{{ row.account.code }}</span>
            </template>

            <template #cell-name="{ row }">
              <span class="text-ink-primary">{{ row.account.name }}</span>
            </template>

            <template #cell-opening="{ row }">
              <span class="amount block">{{ row.openingDebit > 0 ? formatCurrency(row.openingDebit) : EMPTY }}</span>
              <span class="amount block text-xs text-ink-muted">
                {{ row.openingCredit > 0 ? `(K) ${formatCurrency(row.openingCredit)}` : '' }}
              </span>
            </template>

            <template #cell-mutation="{ row }">
              <span class="amount block">{{ row.mutationDebit > 0 ? formatCurrency(row.mutationDebit) : EMPTY }}</span>
              <span class="amount block text-xs text-ink-muted">
                {{ row.mutationCredit > 0 ? `(K) ${formatCurrency(row.mutationCredit)}` : '' }}
              </span>
            </template>

            <template #cell-ending="{ row }">
              <span class="amount block font-semibold">
                {{ row.endingDebit > 0 ? formatCurrency(row.endingDebit) : EMPTY }}
              </span>
              <span class="amount block text-xs text-ink-muted">
                {{ row.endingCredit > 0 ? `(K) ${formatCurrency(row.endingCredit)}` : '' }}
              </span>
            </template>

            <template #empty>
              <div class="px-4 pb-4">
                <EmptyState title="Neraca saldo kosong" description="Belum ada akun yang bersaldo." />
              </div>
            </template>
          </BaseTable>

          <div class="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-3">
            <div class="rounded-control border border-line px-4 py-3">
              <p class="text-small text-ink-secondary">Total saldo debit</p>
              <p class="amount mt-1 text-data font-semibold text-ink-primary">
                {{ formatCurrency(trialBalance.totalDebit) }}
              </p>
            </div>
            <div class="rounded-control border border-line px-4 py-3">
              <p class="text-small text-ink-secondary">Total saldo kredit</p>
              <p class="amount mt-1 text-data font-semibold text-ink-primary">
                {{ formatCurrency(trialBalance.totalCredit) }}
              </p>
            </div>
            <div class="flex items-center justify-between gap-3 rounded-control border border-line bg-surface-alt px-4 py-3">
              <div>
                <p class="text-small text-ink-secondary">Selisih</p>
                <p class="amount mt-1 text-data font-semibold text-ink-primary">
                  {{ formatCurrency(Math.abs(trialBalance.difference)) }}
                </p>
              </div>
              <BaseBadge :status="trialBalance.difference === 0 ? 'balanced' : 'unbalanced'" />
            </div>
          </div>
        </div>
      </BaseCard>

      <IntegrationNote title="Pembukuan tidak bisa ketinggalan transaksi">
        Jurnal di halaman ini <strong>tidak disimpan</strong>; ia diturunkan ulang dari faktur
        penjualan, faktur pembelian, beban, pembayaran, dan mutasi gudang setiap kali dibaca. Karena
        itu mustahil ada transaksi yang tercatat di modul operasional tetapi hilang dari pembukuan —
        satu-satunya jurnal yang benar-benar ditulis manusia adalah jurnal manual, dan itu pun ditolak
        kalau tidak seimbang.
      </IntegrationNote>
    </template>

    <BaseModal
      :open="formOpen"
      title="Jurnal Manual"
      description="Untuk penyusutan, koreksi, dan reklasifikasi. Wajib seimbang sebelum bisa disimpan."
      @close="formOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitForm">
        <BaseInput v-model="form.date" label="Tanggal" type="date" required />
        <BaseInput
          v-model="form.description"
          label="Keterangan"
          required
          placeholder="Mis. Penyusutan kendaraan Juli 2026"
        />

        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-ink-secondary">Baris jurnal</p>
            <BaseButton size="sm" variant="secondary" icon="plus" @click="addLine">Tambah Baris</BaseButton>
          </div>

          <div
            v-for="(line, index) in formLines"
            :key="index"
            class="flex flex-col gap-2 rounded-control border border-line p-3"
          >
            <div class="flex items-center gap-2">
              <select
                v-model="line.accountCode"
                class="min-w-0 flex-1 rounded-control border border-line bg-surface-alt px-3 py-2 text-data text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option v-for="account in CHART_OF_ACCOUNTS" :key="account.code" :value="account.code">
                  {{ account.code }} — {{ account.name }}
                </option>
              </select>

              <BaseButton
                size="sm"
                variant="ghost"
                icon="close"
                :disabled="formLines.length <= 2"
                @click="removeLine(index)"
              >
                <span class="sr-only">Hapus baris</span>
              </BaseButton>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <BaseInput v-model="line.debit" label="Debit" type="number" :min="0" />
              <BaseInput v-model="line.credit" label="Kredit" type="number" :min="0" />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2 rounded-control border border-line bg-surface-alt px-4 py-3">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-small text-ink-secondary">Total debit</span>
            <span class="amount text-data text-ink-primary">{{ formatCurrency(formTotals.debit) }}</span>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-small text-ink-secondary">Total kredit</span>
            <span class="amount text-data text-ink-primary">{{ formatCurrency(formTotals.credit) }}</span>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-line pt-2">
            <span class="text-small font-medium text-ink-primary">Selisih</span>
            <span class="flex items-center gap-2">
              <span class="amount text-data font-semibold text-ink-primary">
                {{ formatCurrency(Math.abs(formTotals.difference)) }}
              </span>
              <BaseBadge :status="formTotals.difference === 0 ? 'balanced' : 'unbalanced'" />
            </span>
          </div>
        </div>
      </form>

      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">Batal</BaseButton>
        <BaseButton :loading="saving" :disabled="!formValid" @click="submitForm">
          Simpan Jurnal
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
