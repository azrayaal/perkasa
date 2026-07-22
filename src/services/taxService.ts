/**
 * Modul Perpajakan.
 *
 * Tidak ada satu pun angka pajak yang diinput ulang di sini. PPN keluaran
 * diambil dari faktur penjualan, PPN masukan dari faktur pembelian & beban
 * ber-PPN, PPh potong-pungut dari potongan pada beban, dan taksiran PPh badan
 * dari laba sebelum pajak di laporan laba rugi.
 *
 * Artinya: kalau ada faktur yang salah, SPT-nya ikut salah — persis seperti
 * kenyataan, dan itulah gunanya semua modul memakai sumber yang sama.
 */
import { CHART_OF_ACCOUNTS, ACC } from '@/data/chartOfAccounts'
import { db } from '@/data/db'
import { respond } from '@/services/http'
import { balancesAsOf } from '@/services/ledgerService'
import { buildIncomeStatement } from '@/services/reportService'
import { endOfMonth, periodLabel, periodOf, periodRange, startOfMonth } from '@/utils/date'
import type {
  CorporateTaxEstimate,
  PeriodKey,
  TaxFilingStatus,
  TaxOverview,
  VatPeriodSummary,
  WithholdingSummary,
  WithholdingType,
} from '@/types'

function filingStatus(payable: number): TaxFilingStatus {
  if (payable > 0) return 'kurang-bayar'
  return payable < 0 ? 'lebih-bayar' : 'nihil'
}

/** Rekap SPT Masa PPN satu periode, langsung dari dokumen sumbernya. */
export function buildVatSummary(period: PeriodKey): VatPeriodSummary {
  const database = db()

  const sales = database.salesInvoices.filter(
    (invoice) => invoice.status !== 'draft' && periodOf(invoice.date) === period,
  )
  const purchases = database.purchaseInvoices.filter((invoice) => periodOf(invoice.date) === period)
  const expenses = database.expenses.filter(
    (expense) => expense.ppn > 0 && periodOf(expense.date) === period,
  )

  const outputBase = sales.reduce((sum, invoice) => sum + invoice.totals.dpp, 0)
  const outputVat = sales.reduce((sum, invoice) => sum + invoice.totals.ppn, 0)

  const inputBase =
    purchases.reduce((sum, invoice) => sum + invoice.totals.dpp, 0) +
    expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const inputVat =
    purchases.reduce((sum, invoice) => sum + invoice.totals.ppn, 0) +
    expenses.reduce((sum, expense) => sum + expense.ppn, 0)

  const payable = outputVat - inputVat

  return {
    period,
    label: periodLabel(period),
    outputBase,
    outputVat,
    inputBase,
    inputVat,
    payable,
    status: filingStatus(payable),
    unnumberedInvoices: sales.filter((invoice) => invoice.taxInvoiceNumber === null).length,
  }
}

const WITHHOLDING_META: Array<{ type: Exclude<WithholdingType, 'none'>; label: string; rateLabel: string }> = [
  { type: 'pph21', label: 'PPh Pasal 21 — Karyawan', rateLabel: 'Efektif 3,5%' },
  { type: 'pph23', label: 'PPh Pasal 23 — Jasa', rateLabel: '2% dari bruto' },
  { type: 'pph4-2', label: 'PPh Final Pasal 4(2) — Sewa', rateLabel: '10% final' },
]

function buildWithholdings(from: string, to: string): WithholdingSummary[] {
  const expenses = db().expenses.filter((expense) => expense.date >= from && expense.date <= to)

  return WITHHOLDING_META.map((meta) => {
    const matched = expenses.filter((expense) => expense.withholding === meta.type)
    return {
      ...meta,
      base: matched.reduce((sum, expense) => sum + expense.amount, 0),
      amount: matched.reduce((sum, expense) => sum + expense.withholdingAmount, 0),
      count: matched.length,
    }
  })
}

/** Taksiran PPh badan berjalan berdasarkan laba fiskal tahun berjalan. */
function buildCorporateEstimate(yearStart: string, to: string): CorporateTaxEstimate {
  const income = buildIncomeStatement(yearStart, to)
  const rate = db().company.corporateTaxRate
  const estimatedTax = Math.max(0, Math.round((income.profitBeforeTax * rate) / 100))
  const prepaid = balancesAsOf(to).get(ACC.prepaidCorporateTax) ?? 0

  return {
    profitBeforeTax: income.profitBeforeTax,
    rate,
    estimatedTax,
    prepaid,
    payable: estimatedTax - prepaid,
  }
}

/** TODO: replace with real API call — GET /tax/overview?period= */
export function getTaxOverview(period: PeriodKey): Promise<TaxOverview> {
  const database = db()
  const yearStart = `${database.company.fiscalYear}-01-01`
  const to = endOfMonth(period)

  const customerName = new Map(database.customers.map((row) => [row.id, row.name]))
  const balances = balancesAsOf(to)

  const taxLiability = CHART_OF_ACCOUNTS.filter((account) => account.group === 'utang-pajak').reduce(
    (sum, account) => sum + (balances.get(account.code) ?? 0),
    0,
  )

  const pendingTaxInvoices = database.salesInvoices
    .filter((invoice) => invoice.status !== 'draft' && invoice.taxInvoiceNumber === null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      customerName: customerName.get(invoice.customerId) ?? '—',
      ppn: invoice.totals.ppn,
    }))

  return respond({
    vat: buildVatSummary(period),
    vatTrend: periodRange(periodOf(yearStart), period).map(buildVatSummary),
    withholdings: buildWithholdings(startOfMonth(period), to),
    corporate: buildCorporateEstimate(yearStart, to),
    taxLiability,
    pendingTaxInvoices,
  })
}
