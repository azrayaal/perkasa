/**
 * Laporan keuangan: neraca, laba rugi, arus kas, dan perubahan ekuitas.
 *
 * Empat laporan ini tidak dihitung sendiri-sendiri. Semuanya membaca saldo yang
 * sama dari `ledgerService`, sehingga laba bersih di laba rugi PASTI sama
 * dengan penambah ekuitas di neraca, dan mutasi kas di arus kas PASTI sama
 * dengan selisih saldo kas di neraca.
 */
import {
  CHART_OF_ACCOUNTS,
  CURRENT_ASSET_GROUPS,
  CURRENT_LIABILITY_GROUPS,
  EQUITY_GROUPS,
  FIXED_ASSET_GROUPS,
  GROUP_LABEL,
  accountByCode,
} from '@/data/chartOfAccounts'
import { db } from '@/data/db'
import { respond } from '@/services/http'
import { balancesAsOf, mutationsBetween } from '@/services/ledgerService'
import { buildJournal } from '@/services/postingService'
import { addDays } from '@/utils/date'
import type {
  Account,
  AccountCode,
  AccountGroup,
  BalanceSheet,
  CashFlowCategory,
  CashFlowStatement,
  EquityStatement,
  IncomeStatement,
  IsoDate,
  ReportLine,
  ReportSection,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* Helper penyusun section                                                     */
/* -------------------------------------------------------------------------- */

function accountsInGroups(groups: AccountGroup[]): Account[] {
  return CHART_OF_ACCOUNTS.filter((account) => groups.includes(account.group))
}

/**
 * Susun satu blok laporan dari daftar akun.
 * Akun kontra disajikan negatif supaya pembaca langsung melihat pengurangnya.
 */
function section(
  key: string,
  title: string,
  accounts: Account[],
  balances: Map<AccountCode, number>,
): ReportSection {
  const lines: ReportLine[] = []
  let total = 0

  for (const account of accounts) {
    const balance = balances.get(account.code) ?? 0
    if (balance === 0) continue

    const amount = account.contra ? -balance : balance
    lines.push({ code: account.code, label: account.name, amount })
    total += amount
  }

  return { key, title, lines, total }
}

/* -------------------------------------------------------------------------- */
/* Laba rugi                                                                   */
/* -------------------------------------------------------------------------- */

function percent(part: number, whole: number): number {
  if (whole === 0) return 0
  return Number(((part / whole) * 100).toFixed(1))
}

export function buildIncomeStatement(from: IsoDate, to: IsoDate): IncomeStatement {
  const mutation = mutationsBetween(from, to)

  const revenue = section('pendapatan', GROUP_LABEL.pendapatan, accountsInGroups(['pendapatan']), mutation)
  const cogs = section('harga-pokok', GROUP_LABEL['harga-pokok'], accountsInGroups(['harga-pokok']), mutation)
  const operatingExpenses = section(
    'beban-operasional',
    GROUP_LABEL['beban-operasional'],
    accountsInGroups(['beban-operasional']),
    mutation,
  )
  const otherIncome = section('pendapatan-lain', GROUP_LABEL['pendapatan-lain'], accountsInGroups(['pendapatan-lain']), mutation)
  const otherExpenses = section('beban-lain', GROUP_LABEL['beban-lain'], accountsInGroups(['beban-lain']), mutation)

  const taxSection = section('pajak-penghasilan', GROUP_LABEL['pajak-penghasilan'], accountsInGroups(['pajak-penghasilan']), mutation)

  const grossProfit = revenue.total - cogs.total
  const operatingProfit = grossProfit - operatingExpenses.total
  const profitBeforeTax = operatingProfit + otherIncome.total - otherExpenses.total
  const netProfit = profitBeforeTax - taxSection.total

  return {
    from,
    to,
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    otherIncome,
    otherExpenses,
    profitBeforeTax,
    taxExpense: taxSection.total,
    netProfit,
    grossMargin: percent(grossProfit, revenue.total),
    netMargin: percent(netProfit, revenue.total),
  }
}

/** TODO: replace with real API call | GET /reports/income-statement?from=&to= */
export function getIncomeStatement(from: IsoDate, to: IsoDate): Promise<IncomeStatement> {
  return respond(buildIncomeStatement(from, to))
}

/** Laba bersih periode | dipakai neraca & dashboard. */
export function netProfitBetween(from: IsoDate, to: IsoDate): number {
  return buildIncomeStatement(from, to).netProfit
}

/* -------------------------------------------------------------------------- */
/* Neraca                                                                      */
/* -------------------------------------------------------------------------- */

export function buildBalanceSheet(asOf: IsoDate): BalanceSheet {
  const balances = balancesAsOf(asOf)
  const yearStart: IsoDate = `${db().company.fiscalYear}-01-01`

  const currentAssets = section('aset-lancar', 'Aset Lancar', accountsInGroups(CURRENT_ASSET_GROUPS), balances)
  const fixedAssets = section('aset-tetap', 'Aset Tetap', accountsInGroups(FIXED_ASSET_GROUPS), balances)
  const currentLiabilities = section('kewajiban-lancar', 'Kewajiban Lancar', accountsInGroups(CURRENT_LIABILITY_GROUPS), balances)
  const longTermLiabilities = section('kewajiban-jangka-panjang', 'Kewajiban Jangka Panjang', accountsInGroups(['utang-jangka-panjang']), balances)
  const equity = section('ekuitas', 'Ekuitas', accountsInGroups(EQUITY_GROUPS), balances)

  // Laba tahun berjalan belum ditutup ke laba ditahan, jadi ditambahkan
  // sebagai baris tersendiri | persis penyajian neraca interim.
  const currentEarnings = netProfitBetween(yearStart, asOf)

  const totalAssets = currentAssets.total + fixedAssets.total
  const totalLiabilities = currentLiabilities.total + longTermLiabilities.total
  const totalEquity = equity.total + currentEarnings

  return {
    asOf,
    currentAssets,
    fixedAssets,
    totalAssets,
    currentLiabilities,
    longTermLiabilities,
    totalLiabilities,
    equity,
    currentEarnings,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    imbalance: totalAssets - (totalLiabilities + totalEquity),
  }
}

/** TODO: replace with real API call | GET /reports/balance-sheet?asOf= */
export function getBalanceSheet(asOf: IsoDate): Promise<BalanceSheet> {
  return respond(buildBalanceSheet(asOf))
}

/* -------------------------------------------------------------------------- */
/* Arus kas (metode langsung)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Akun yang klasifikasinya tidak bisa ditebak dari kelompoknya.
 * Utang bank masuk aktivitas pendanaan walau tercatat sebagai utang lancar.
 */
const CATEGORY_OVERRIDE: Record<AccountCode, CashFlowCategory> = {
  '2400': 'pendanaan',
  '2500': 'pendanaan',
}

const GROUP_CATEGORY: Record<AccountGroup, CashFlowCategory> = {
  'kas-bank': 'operasi',
  piutang: 'operasi',
  persediaan: 'operasi',
  'aset-lancar-lain': 'operasi',
  'aset-tetap': 'investasi',
  'akumulasi-penyusutan': 'investasi',
  'utang-usaha': 'operasi',
  'utang-pajak': 'operasi',
  'utang-lancar-lain': 'operasi',
  'utang-jangka-panjang': 'pendanaan',
  modal: 'pendanaan',
  'laba-ditahan': 'pendanaan',
  pendapatan: 'operasi',
  'harga-pokok': 'operasi',
  'beban-operasional': 'operasi',
  'pendapatan-lain': 'operasi',
  'beban-lain': 'operasi',
  'pajak-penghasilan': 'operasi',
}

const CATEGORY_TITLE: Record<CashFlowCategory, string> = {
  operasi: 'Arus Kas dari Aktivitas Operasi',
  investasi: 'Arus Kas dari Aktivitas Investasi',
  pendanaan: 'Arus Kas dari Aktivitas Pendanaan',
}

function cashBalanceAsOf(asOf: IsoDate): number {
  const balances = balancesAsOf(asOf)
  return CHART_OF_ACCOUNTS.filter((account) => account.cash).reduce(
    (sum, account) => sum + (balances.get(account.code) ?? 0),
    0,
  )
}

export function buildCashFlow(from: IsoDate, to: IsoDate): CashFlowStatement {
  const cashCodes = new Set(CHART_OF_ACCOUNTS.filter((account) => account.cash).map((a) => a.code))

  // Setiap baris non-kas dalam jurnal yang menyentuh kas menjelaskan ke mana
  // uangnya pergi. Karena jurnal selalu seimbang, penjumlahannya pasti sama
  // dengan mutasi kas periode tersebut.
  const perAccount = new Map<AccountCode, number>()

  for (const entry of buildJournal()) {
    if (entry.date < from || entry.date > to) continue
    if (!entry.lines.some((row) => cashCodes.has(row.accountCode))) continue

    for (const row of entry.lines) {
      if (cashCodes.has(row.accountCode)) continue
      const effect = row.credit - row.debit
      if (effect === 0) continue
      perAccount.set(row.accountCode, (perAccount.get(row.accountCode) ?? 0) + effect)
    }
  }

  const grouped: Record<CashFlowCategory, ReportLine[]> = { operasi: [], investasi: [], pendanaan: [] }

  for (const [code, amount] of perAccount) {
    if (amount === 0) continue
    const account = accountByCode(code)
    const category = CATEGORY_OVERRIDE[code] ?? GROUP_CATEGORY[account.group]
    grouped[category].push({ code, label: account.name, amount })
  }

  const sections = (Object.keys(grouped) as CashFlowCategory[]).map((category) => {
    const lines = grouped[category].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    return {
      category,
      title: CATEGORY_TITLE[category],
      lines,
      total: lines.reduce((sum, row) => sum + row.amount, 0),
    }
  })

  const openingCash = cashBalanceAsOf(addDays(from, -1))
  const netChange = sections.reduce((sum, item) => sum + item.total, 0)

  return {
    from,
    to,
    openingCash,
    sections,
    netChange,
    closingCash: openingCash + netChange,
  }
}

/** TODO: replace with real API call | GET /reports/cash-flow?from=&to= */
export function getCashFlow(from: IsoDate, to: IsoDate): Promise<CashFlowStatement> {
  return respond(buildCashFlow(from, to))
}

/* -------------------------------------------------------------------------- */
/* Perubahan ekuitas                                                           */
/* -------------------------------------------------------------------------- */

export function buildEquityStatement(from: IsoDate, to: IsoDate): EquityStatement {
  const opening = balancesAsOf(addDays(from, -1))
  const mutation = mutationsBetween(from, to)

  const openingCapital = opening.get('3100') ?? 0
  const openingRetained = opening.get('3200') ?? 0
  const additionalCapital = mutation.get('3100') ?? 0
  const netProfit = netProfitBetween(from, to)

  return {
    from,
    to,
    openingCapital,
    openingRetained,
    additionalCapital,
    netProfit,
    closingEquity: openingCapital + openingRetained + additionalCapital + netProfit,
  }
}

/** TODO: replace with real API call | GET /reports/equity?from=&to= */
export function getEquityStatement(from: IsoDate, to: IsoDate): Promise<EquityStatement> {
  return respond(buildEquityStatement(from, to))
}

/**
 * Paket lengkap laporan keuangan satu periode | dipakai halaman
 * "Laporan Keuangan" supaya keempatnya dimuat dalam satu permintaan.
 */
export interface FinancialStatements {
  income: IncomeStatement
  balance: BalanceSheet
  cashFlow: CashFlowStatement
  equity: EquityStatement
}

/** TODO: replace with real API call | GET /reports/financial-statements?from=&to= */
export function getFinancialStatements(from: IsoDate, to: IsoDate): Promise<FinancialStatements> {
  return respond({
    income: buildIncomeStatement(from, to),
    balance: buildBalanceSheet(to),
    cashFlow: buildCashFlow(from, to),
    equity: buildEquityStatement(from, to),
  })
}
