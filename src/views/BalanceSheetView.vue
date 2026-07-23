<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IntegrationNote from '@/components/erp/IntegrationNote.vue'
import ReportSectionTable from '@/components/erp/ReportSectionTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseCallout from '@/components/ui/BaseCallout.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { getCompanyProfile } from '@/services/masterService'
import { getBalanceSheet } from '@/services/reportService'
import { usePeriodStore } from '@/stores/periodStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import type { BalanceSheet, CompanyProfile, ReportSection } from '@/types'
import { EMPTY } from '@/utils/placeholder'

const period = usePeriodStore()

const sheet = ref<BalanceSheet | null>(null)
const company = ref<CompanyProfile | null>(null)
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true

  const [sheetResult, companyResult] = await Promise.all([
    getBalanceSheet(period.to),
    getCompanyProfile(),
  ])

  sheet.value = sheetResult
  company.value = companyResult
  loading.value = false
}

watch(() => [period.from, period.to], load, { immediate: true })

/**
 * Rasio lancar cukup dihitung di view: bukan angka akuntansi baru, hanya
 * pembagian dua subtotal yang keduanya sudah datang dari service.
 */
const currentRatio = computed(() => {
  if (!sheet.value) return '0,00'
  const liabilities = sheet.value.currentLiabilities.total
  if (liabilities === 0) return EMPTY
  return (sheet.value.currentAssets.total / liabilities).toFixed(2).replace('.', ',')
})

/**
 * Ekuitas disajikan dengan laba tahun berjalan sebagai baris tersendiri |
 * persis penyajian neraca interim sebelum tutup buku.
 */
const equitySection = computed<ReportSection | null>(() => {
  if (!sheet.value) return null

  return {
    key: 'ekuitas-lengkap',
    title: 'Ekuitas',
    lines: [
      ...sheet.value.equity.lines,
      { code: '3300', label: 'Laba Tahun Berjalan', amount: sheet.value.currentEarnings },
    ],
    total: sheet.value.totalEquity,
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Neraca"
      :description="`Posisi keuangan per ${formatDate(period.to)}. Seluruh saldo dibaca langsung dari buku besar, tanpa entri manual.`"
    />

    <LoadingState v-if="loading" :rows="6" />

    <template v-else-if="sheet && equitySection">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Aset"
          :value="formatCurrency(sheet.totalAssets)"
          icon="balance"
          tone="brand"
          caption="Aset lancar dan aset tetap"
        />
        <StatCard
          label="Total Kewajiban"
          :value="formatCurrency(sheet.totalLiabilities)"
          icon="purchase"
          caption="Kewajiban lancar dan jangka panjang"
        />
        <StatCard
          label="Total Ekuitas"
          :value="formatCurrency(sheet.totalEquity)"
          icon="building"
          :caption="`Termasuk laba berjalan ${formatCurrency(sheet.currentEarnings)}`"
        />
        <StatCard
          label="Rasio Lancar"
          :value="currentRatio"
          icon="percent"
          caption="Aset lancar dibagi kewajiban lancar"
        />
      </div>

      <BaseCallout v-if="sheet.imbalance === 0" tone="note" title="Neraca seimbang">
        Total Aset {{ formatCurrency(sheet.totalAssets) }} sama persis dengan Kewajiban ditambah
        Ekuitas. Keseimbangan ini bukan hasil penyesuaian: setiap jurnal yang terbentuk dari
        dokumen selalu berpasangan debit–kredit.
      </BaseCallout>

      <BaseCallout v-else tone="danger" title="Neraca tidak seimbang">
        Terdapat selisih {{ formatCurrency(sheet.imbalance) }} antara Total Aset dan jumlah
        Kewajiban + Ekuitas. Periksa jurnal manual pada periode ini sebelum laporan dipakai.
      </BaseCallout>

      <!-- Tata letak dua kolom ala neraca cetak: aktiva kiri, pasiva kanan. -->
      <BaseCard>
        <header class="border-b border-line pb-4 text-center">
          <p class="text-h3 text-ink-primary">{{ company?.legalName ?? company?.name ?? '' }}</p>
          <p class="mt-1 text-h4 text-ink-primary">Neraca</p>
          <p class="mt-1 text-small text-ink-secondary">Per {{ formatDate(sheet.asOf) }}</p>
        </header>

        <div class="grid grid-cols-1 gap-x-10 gap-y-8 pt-6 lg:grid-cols-2">
          <section class="flex flex-col gap-6">
            <h2 class="text-h4 uppercase tracking-wide text-ink-secondary">Aktiva</h2>

            <ReportSectionTable :section="sheet.currentAssets" />
            <ReportSectionTable :section="sheet.fixedAssets" />

            <table class="w-full border-collapse text-data">
              <tbody>
                <tr class="border-y-2 border-ink-strong">
                  <td class="py-3 pr-4 text-h4 text-ink-primary">TOTAL ASET</td>
                  <td class="amount w-44 py-3 text-right text-h4 text-ink-primary">
                    {{ formatCurrency(sheet.totalAssets) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="flex flex-col gap-6">
            <h2 class="text-h4 uppercase tracking-wide text-ink-secondary">Pasiva</h2>

            <ReportSectionTable :section="sheet.currentLiabilities" />
            <ReportSectionTable :section="sheet.longTermLiabilities" />

            <table class="w-full border-collapse text-data">
              <tbody>
                <tr class="border-t border-line">
                  <td class="py-3 pr-4 font-semibold text-ink-primary">Jumlah Kewajiban</td>
                  <td class="amount w-44 py-3 text-right font-bold text-ink-primary">
                    {{ formatCurrency(sheet.totalLiabilities) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <ReportSectionTable :section="equitySection" total-label="Jumlah Ekuitas" />

            <table class="w-full border-collapse text-data">
              <tbody>
                <tr class="border-y-2 border-ink-strong">
                  <td class="py-3 pr-4 text-h4 text-ink-primary">TOTAL PASIVA</td>
                  <td class="amount w-44 py-3 text-right text-h4 text-ink-primary">
                    {{ formatCurrency(sheet.totalLiabilitiesAndEquity) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </BaseCard>

      <IntegrationNote title="Tidak ada saldo neraca yang diketik manual">
        Saldo <strong>Kas &amp; Bank</strong> berasal dari bukti kas masuk/keluar,
        <strong>Piutang Usaha</strong> dari faktur penjualan yang belum lunas,
        <strong>Persediaan</strong> dari kartu stok gudang, <strong>Utang Usaha</strong> dari faktur
        pembelian, dan <strong>Utang Pajak</strong> dari PPN keluaran–masukan serta PPh yang
        dipotong. Semuanya terbentuk bersamaan saat dokumen diposting — tidak perlu tutup buku
        manual untuk melihat neraca hari ini.
      </IntegrationNote>
    </template>
  </div>
</template>
