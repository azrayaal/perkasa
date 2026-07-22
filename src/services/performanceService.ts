/**
 * Modul Performa.
 *
 * Semua indikator di sini adalah turunan dari laporan keuangan | bukan angka
 * marketing yang dihitung terpisah. Marjin kotor di halaman Performa dijamin
 * sama dengan laba kotor di Laba Rugi karena keduanya memanggil fungsi yang
 * sama, dan perputaran persediaan memakai HPP dari jurnal yang sama.
 */
import { CHART_OF_ACCOUNTS, ACC } from '@/data/chartOfAccounts'
import { db } from '@/data/db'
import { today } from '@/services/clock'
import { buildExpenseBreakdown } from '@/services/expenseService'
import { respond } from '@/services/http'
import { balancesAsOf, mutationsBetween } from '@/services/ledgerService'
import { buildPurchaseRows, buildPayableAging } from '@/services/purchaseService'
import { buildIncomeStatement, buildBalanceSheet } from '@/services/reportService'
import { buildReceivableAging, buildSalesRows } from '@/services/salesService'
import { buildJournal } from '@/services/postingService'
import { endOfMonth, periodLabel, periodOf, periodRange, startOfMonth } from '@/utils/date'
import { lineAmount } from '@/utils/documentTotals'
import type {
  FinancialRatio,
  IsoDate,
  MonthlyPoint,
  PerformanceReport,
  RankedItem,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* Tren bulanan                                                                */
/* -------------------------------------------------------------------------- */

const CASH_CODES = new Set(CHART_OF_ACCOUNTS.filter((account) => account.cash).map((a) => a.code))

/** Deret bulanan tahun buku sampai bulan `upTo` (inklusif). */
export function buildMonthlySeries(upTo: IsoDate = today()): MonthlyPoint[] {
  const database = db()
  const periods = periodRange(`${database.company.fiscalYear}-01`, periodOf(upTo))
  const journal = buildJournal()

  return periods.map((period) => {
    const from = startOfMonth(period)
    // Bulan berjalan dipotong pada tanggal hari ini, bukan akhir bulan.
    const to = endOfMonth(period) > upTo ? upTo : endOfMonth(period)

    const income = buildIncomeStatement(from, to)

    const purchase = database.purchaseInvoices
      .filter((invoice) => invoice.date >= from && invoice.date <= to)
      .reduce((sum, invoice) => sum + invoice.totals.dpp, 0)

    let cashIn = 0
    let cashOut = 0
    for (const entry of journal) {
      if (entry.date < from || entry.date > to) continue
      for (const line of entry.lines) {
        if (!CASH_CODES.has(line.accountCode)) continue
        cashIn += line.debit
        cashOut += line.credit
      }
    }

    return {
      period,
      label: periodLabel(period),
      revenue: income.revenue.total,
      cogs: income.cogs.total,
      expense: income.operatingExpenses.total,
      grossProfit: income.grossProfit,
      netProfit: income.netProfit,
      purchase,
      cashIn,
      cashOut,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Peringkat produk & pelanggan                                                */
/* -------------------------------------------------------------------------- */

function rank(entries: Map<string, { label: string; sublabel: string; value: number }>): RankedItem[] {
  const total = [...entries.values()].reduce((sum, row) => sum + row.value, 0)

  return [...entries.entries()]
    .map(([id, row]) => ({
      id,
      ...row,
      share: total === 0 ? 0 : Number(((row.value / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.value - a.value)
}

function buildTopProducts(from: IsoDate, to: IsoDate): RankedItem[] {
  const database = db()
  const productById = new Map(database.products.map((row) => [row.id, row]))
  const entries = new Map<string, { label: string; sublabel: string; value: number }>()

  for (const row of buildSalesRows(from, to)) {
    if (row.status === 'draft') continue

    for (const line of row.invoice.lines) {
      const product = productById.get(line.productId)
      if (!product) continue

      const current = entries.get(product.id) ?? {
        label: product.name,
        sublabel: product.sku,
        value: 0,
      }
      current.value += lineAmount(line)
      entries.set(product.id, current)
    }
  }

  return rank(entries)
}

function buildTopCustomers(from: IsoDate, to: IsoDate): RankedItem[] {
  const database = db()
  const customerById = new Map(database.customers.map((row) => [row.id, row]))
  const entries = new Map<string, { label: string; sublabel: string; value: number }>()

  for (const row of buildSalesRows(from, to)) {
    if (row.status === 'draft') continue

    const customer = customerById.get(row.invoice.customerId)
    if (!customer) continue

    const current = entries.get(customer.id) ?? {
      label: customer.name,
      sublabel: customer.city,
      value: 0,
    }
    current.value += row.invoice.totals.dpp
    entries.set(customer.id, current)
  }

  return rank(entries)
}

/* -------------------------------------------------------------------------- */
/* Rasio keuangan                                                              */
/* -------------------------------------------------------------------------- */

function ratio(value: number, divisor: number): number {
  return divisor === 0 ? 0 : Number((value / divisor).toFixed(2))
}

function buildRatios(from: IsoDate, to: IsoDate): FinancialRatio[] {
  const income = buildIncomeStatement(from, to)
  const balance = buildBalanceSheet(to)
  const balances = balancesAsOf(to)

  const receivable = balances.get(ACC.receivable) ?? 0
  const inventory = balances.get(ACC.inventory) ?? 0
  const payable = balances.get(ACC.payable) ?? 0

  // Periode ini belum setahun penuh, jadi rasio perputaran disetahunkan.
  const days = Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 + 1)
  const annualizer = 365 / days

  return [
    {
      key: 'gross-margin',
      label: 'Marjin Laba Kotor',
      value: income.grossMargin,
      format: 'percent',
      benchmark: 18,
      direction: 'higher',
      hint: 'Laba kotor dibagi pendapatan. Distributor material sehat di kisaran 18–25%.',
    },
    {
      key: 'net-margin',
      label: 'Marjin Laba Bersih',
      value: income.netMargin,
      format: 'percent',
      benchmark: 3,
      direction: 'higher',
      hint: 'Laba bersih setelah pajak dibagi pendapatan.',
    },
    {
      key: 'opex-ratio',
      label: 'Beban Operasional / Pendapatan',
      value:
        income.revenue.total === 0
          ? 0
          : Number(((income.operatingExpenses.total / income.revenue.total) * 100).toFixed(1)),
      format: 'percent',
      benchmark: 15,
      direction: 'lower',
      hint: 'Semakin rendah, semakin efisien biaya menjalankan usaha.',
    },
    {
      key: 'current-ratio',
      label: 'Rasio Lancar',
      value: ratio(balance.currentAssets.total, balance.currentLiabilities.total),
      format: 'ratio',
      benchmark: 1.5,
      direction: 'higher',
      hint: 'Aset lancar dibagi kewajiban lancar | kemampuan bayar jangka pendek.',
    },
    {
      key: 'debt-to-equity',
      label: 'Rasio Utang terhadap Ekuitas',
      value: ratio(balance.totalLiabilities, balance.totalEquity),
      format: 'ratio',
      benchmark: 1.5,
      direction: 'lower',
      hint: 'Semakin rendah, semakin kecil ketergantungan pada pendanaan utang.',
    },
    {
      key: 'roa',
      label: 'Imbal Hasil Aset (ROA)',
      value:
        balance.totalAssets === 0
          ? 0
          : Number((((income.netProfit * annualizer) / balance.totalAssets) * 100).toFixed(1)),
      format: 'percent',
      benchmark: 6,
      direction: 'higher',
      hint: 'Laba bersih disetahunkan dibagi total aset.',
    },
    {
      key: 'receivable-days',
      label: 'Rata-rata Umur Piutang',
      value: income.revenue.total === 0 ? 0 : Math.round((receivable / income.revenue.total) * days),
      format: 'days',
      benchmark: 45,
      direction: 'lower',
      hint: 'Berapa hari rata-rata uang tertahan di pelanggan.',
    },
    {
      key: 'payable-days',
      label: 'Rata-rata Umur Utang',
      value: income.cogs.total === 0 ? 0 : Math.round((payable / income.cogs.total) * days),
      format: 'days',
      benchmark: 30,
      direction: 'higher',
      hint: 'Berapa hari rata-rata perusahaan memakai termin pemasok.',
    },
    {
      key: 'inventory-turnover',
      label: 'Perputaran Persediaan',
      value: inventory === 0 ? 0 : Number(((income.cogs.total * annualizer) / inventory).toFixed(1)),
      format: 'times',
      benchmark: 5,
      direction: 'higher',
      hint: 'Berapa kali persediaan berputar dalam setahun.',
    },
  ]
}

/* -------------------------------------------------------------------------- */
/* Laporan performa                                                            */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call | GET /performance?from=&to= */
export function getPerformanceReport(from: IsoDate, to: IsoDate): Promise<PerformanceReport> {
  const ratios = buildRatios(from, to)
  const turnover = ratios.find((row) => row.key === 'inventory-turnover')?.value ?? 0

  return respond({
    monthly: buildMonthlySeries(to),
    topProducts: buildTopProducts(from, to),
    topCustomers: buildTopCustomers(from, to),
    expenseBreakdown: buildExpenseBreakdown(from, to),
    ratios,
    receivableAging: buildReceivableAging(),
    payableAging: buildPayableAging(),
    inventoryTurnover: turnover,
  })
}

/** Nilai pembelian periode berjalan | dipakai kartu ringkas di halaman Performa. */
export function purchaseTotalBetween(from: IsoDate, to: IsoDate): number {
  return buildPurchaseRows(from, to).reduce((sum, row) => sum + row.invoice.totals.dpp, 0)
}

/** Mutasi bersih satu akun pada periode | helper kecil untuk widget dashboard. */
export function accountMutation(code: string, from: IsoDate, to: IsoDate): number {
  return mutationsBetween(from, to).get(code) ?? 0
}
