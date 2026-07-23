<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import ReportSectionTable from '@/components/erp/ReportSectionTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TabItem } from '@/components/ui/BaseTabs.types'
import { getCompanyProfile } from '@/services/masterService'
import { getFinancialStatements, type FinancialStatements } from '@/services/reportService'
import { usePeriodStore } from '@/stores/periodStore'
import { formatCurrency, formatPercent } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { CompanyProfile, ReportSection } from '@/types'

const period = usePeriodStore()

const statements = ref<FinancialStatements | null>(null)
const company = ref<CompanyProfile | null>(null)
const loading = ref(true)

const TABS: TabItem[] = [
  { key: 'income', label: 'Laba Rugi' },
  { key: 'cash-flow', label: 'Arus Kas' },
  { key: 'equity', label: 'Perubahan Ekuitas' },
]

const activeTab = ref<string>('income')

const REPORT_TITLE: Record<string, string> = {
  income: 'Laporan Laba Rugi',
  'cash-flow': 'Laporan Arus Kas',
  equity: 'Laporan Perubahan Ekuitas',
}

async function load(): Promise<void> {
  loading.value = true

  const [statementsResult, companyResult] = await Promise.all([
    getFinancialStatements(period.from, period.to),
    getCompanyProfile(),
  ])

  statements.value = statementsResult
  company.value = companyResult
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

/**
 * `CashFlowSection` punya `category`, bukan `key` | dipetakan ke bentuk
 * `ReportSection` supaya tipografi angkanya identik dengan laporan lain.
 */
const cashFlowSections = computed<Array<{ section: ReportSection; totalLabel: string }>>(() =>
  (statements.value?.cashFlow.sections ?? []).map((item) => ({
    section: { key: item.category, title: item.title, lines: item.lines, total: item.total },
    totalLabel: `Kas Bersih dari ${item.title.replace('Arus Kas dari ', '')}`,
  })),
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Laporan Keuangan"
      :description="`Laba rugi, arus kas, dan perubahan ekuitas periode ${period.label} — ketiganya membaca buku besar yang sama.`"
    />

    <LoadingState v-if="loading" :rows="6" />

    <template v-else-if="statements">
      <BaseTabs v-model="activeTab" :tabs="TABS" />

      <BaseCard>
        <header class="border-b border-line pb-4 text-center">
          <p class="text-h3 text-ink-primary">{{ company?.legalName ?? company?.name ?? '' }}</p>
          <p class="mt-1 text-h4 text-ink-primary">{{ REPORT_TITLE[activeTab] }}</p>
          <p class="mt-1 text-small text-ink-secondary">Periode {{ period.label }}</p>
          <p class="text-small text-ink-muted">
            {{ formatDate(period.from) }} – {{ formatDate(period.to) }}
          </p>
        </header>

        <!-- ------------------------------------------------------------- -->
        <!-- Laba Rugi                                                     -->
        <!-- ------------------------------------------------------------- -->
        <div v-if="activeTab === 'income'" class="flex flex-col gap-6 pt-6">
          <ReportSectionTable :section="statements.income.revenue" />
          <ReportSectionTable :section="statements.income.cogs" />

          <table class="w-full border-collapse text-data">
            <tbody>
              <tr class="border-y border-ink-strong">
                <td class="py-3 pr-4 font-semibold text-ink-primary">
                  LABA KOTOR
                  <span class="ml-2 text-small font-normal text-ink-secondary">
                    marjin {{ formatPercent(statements.income.grossMargin) }}
                  </span>
                </td>
                <td class="amount w-44 py-3 text-right font-bold text-ink-primary">
                  {{ formatCurrency(statements.income.grossProfit) }}
                </td>
              </tr>
            </tbody>
          </table>

          <ReportSectionTable :section="statements.income.operatingExpenses" />

          <table class="w-full border-collapse text-data">
            <tbody>
              <tr class="border-y border-ink-strong">
                <td class="py-3 pr-4 font-semibold text-ink-primary">LABA USAHA</td>
                <td class="amount w-44 py-3 text-right font-bold text-ink-primary">
                  {{ formatCurrency(statements.income.operatingProfit) }}
                </td>
              </tr>
            </tbody>
          </table>

          <ReportSectionTable :section="statements.income.otherIncome" />
          <ReportSectionTable :section="statements.income.otherExpenses" />

          <table class="w-full border-collapse text-data">
            <tbody>
              <tr class="border-t border-line">
                <td class="py-3 pr-4 font-semibold text-ink-primary">LABA SEBELUM PAJAK</td>
                <td class="amount w-44 py-3 text-right font-bold text-ink-primary">
                  {{ formatCurrency(statements.income.profitBeforeTax) }}
                </td>
              </tr>
              <tr class="border-t border-line/70">
                <td class="py-2.5 pr-4 text-ink-primary">Beban Pajak Penghasilan</td>
                <td class="amount w-44 py-2.5 text-right text-ink-primary">
                  {{ formatCurrency(statements.income.taxExpense) }}
                </td>
              </tr>
              <!-- Garis ganda pada laba bersih: baris terakhir laporan resmi. -->
              <tr class="border-y-2 border-ink-strong">
                <td class="py-4 pr-4 text-h4 text-ink-primary">
                  LABA BERSIH
                  <span class="ml-2 text-small font-normal text-ink-secondary">
                    marjin {{ formatPercent(statements.income.netMargin) }}
                  </span>
                </td>
                <td class="amount w-44 py-4 text-right text-h4 text-ink-primary">
                  {{ formatCurrency(statements.income.netProfit) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ------------------------------------------------------------- -->
        <!-- Arus Kas (metode langsung)                                    -->
        <!-- ------------------------------------------------------------- -->
        <div v-else-if="activeTab === 'cash-flow'" class="flex flex-col gap-6 pt-6">
          <table class="w-full border-collapse text-data">
            <tbody>
              <tr class="border-b border-line">
                <td class="py-3 pr-4 font-semibold text-ink-primary">
                  Saldo Kas &amp; Bank Awal Periode
                </td>
                <td class="amount w-44 py-3 text-right font-bold text-ink-primary">
                  {{ formatCurrency(statements.cashFlow.openingCash) }}
                </td>
              </tr>
            </tbody>
          </table>

          <ReportSectionTable
            v-for="item in cashFlowSections"
            :key="item.section.key"
            :section="item.section"
            :total-label="item.totalLabel"
          />

          <table class="w-full border-collapse text-data">
            <tbody>
              <tr class="border-y border-ink-strong">
                <td class="py-3 pr-4 font-semibold text-ink-primary">
                  Kenaikan (Penurunan) Bersih Kas
                </td>
                <td class="amount w-44 py-3 text-right font-bold text-ink-primary">
                  {{ formatCurrency(statements.cashFlow.netChange) }}
                </td>
              </tr>
              <tr class="border-y-2 border-ink-strong">
                <td class="py-4 pr-4 text-h4 text-ink-primary">SALDO KAS &amp; BANK AKHIR</td>
                <td class="amount w-44 py-4 text-right text-h4 text-ink-primary">
                  {{ formatCurrency(statements.cashFlow.closingCash) }}
                </td>
              </tr>
            </tbody>
          </table>

          <BaseCallout tone="note" title="Sama dengan Kas & Bank di Neraca">
            Saldo kas akhir {{ formatCurrency(statements.cashFlow.closingCash) }} adalah angka yang
            sama dengan pos Kas &amp; Bank pada Neraca per {{ formatDate(period.to) }}. Arus kas di
            sini bukan rekap terpisah — tiap barisnya adalah lawan jurnal dari setiap mutasi kas.
          </BaseCallout>
        </div>

        <!-- ------------------------------------------------------------- -->
        <!-- Perubahan Ekuitas                                             -->
        <!-- ------------------------------------------------------------- -->
        <div v-else class="pt-6">
          <table class="w-full border-collapse text-data">
            <tbody>
              <tr class="border-b border-line/70">
                <td class="py-2.5 pr-4 text-ink-primary">Modal Disetor Awal Periode</td>
                <td class="amount w-44 py-2.5 text-right text-ink-primary">
                  {{ formatCurrency(statements.equity.openingCapital) }}
                </td>
              </tr>
              <tr class="border-b border-line/70">
                <td class="py-2.5 pr-4 text-ink-primary">Laba Ditahan Awal Periode</td>
                <td class="amount w-44 py-2.5 text-right text-ink-primary">
                  {{ formatCurrency(statements.equity.openingRetained) }}
                </td>
              </tr>
              <tr class="border-b border-line/70">
                <td class="py-2.5 pr-4 pl-6 text-ink-primary">Tambahan Modal Disetor</td>
                <td class="amount w-44 py-2.5 text-right text-ink-primary">
                  {{ formatCurrency(statements.equity.additionalCapital) }}
                </td>
              </tr>
              <tr class="border-b border-line/70">
                <td class="py-2.5 pr-4 pl-6 text-ink-primary">Laba Bersih Periode Berjalan</td>
                <td class="amount w-44 py-2.5 text-right text-ink-primary">
                  {{ formatCurrency(statements.equity.netProfit) }}
                </td>
              </tr>
              <tr class="border-y-2 border-ink-strong">
                <td class="py-4 pr-4 text-h4 text-ink-primary">EKUITAS AKHIR PERIODE</td>
                <td class="amount w-44 py-4 text-right text-h4 text-ink-primary">
                  {{ formatCurrency(statements.equity.closingEquity) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>

      <div v-if="activeTab === 'income'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendapatan"
          :value="formatCurrency(statements.income.revenue.total)"
          icon="sales"
          tone="brand"
          caption="Penjualan bersih sebelum PPN"
        />
        <StatCard
          label="Laba Kotor"
          :value="formatCurrency(statements.income.grossProfit)"
          icon="performance"
          :caption="`Marjin ${formatPercent(statements.income.grossMargin)}`"
        />
        <StatCard
          label="Laba Usaha"
          :value="formatCurrency(statements.income.operatingProfit)"
          icon="report"
          caption="Setelah beban operasional"
        />
        <StatCard
          label="Laba Bersih"
          :value="formatCurrency(statements.income.netProfit)"
          icon="balance"
          :tone="statements.income.netProfit >= 0 ? 'success' : 'error'"
          :caption="`Marjin bersih ${formatPercent(statements.income.netMargin)}`"
        />
      </div>

      <IntegrationNote title="Tiga laporan, satu buku besar">
        Laba bersih {{ formatCurrency(statements.income.netProfit) }} pada Laba Rugi adalah angka
        yang sama persis dengan penambah ekuitas di <strong>Neraca</strong>, dan mutasi kas
        {{ formatCurrency(statements.cashFlow.netChange) }} pada Arus Kas adalah selisih saldo Kas
        &amp; Bank di Neraca antara awal dan akhir periode. Ketiganya cocok bukan karena
        direkonsiliasi, tetapi karena membaca buku besar yang sama.
      </IntegrationNote>
    </template>
  </div>
</template>
