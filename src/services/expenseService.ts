/**
 * Modul Beban.
 *
 * Setiap beban terikat langsung ke akun di bagan akun, jadi angka yang muncul
 * di halaman Beban adalah angka yang sama dengan baris Beban Operasional di
 * Laba Rugi — tidak ada rekap terpisah yang bisa berbeda.
 *
 * Beban juga menjadi sumber dua kewajiban pajak sekaligus: PPN masukan yang
 * bisa dikreditkan, dan PPh potong-pungut yang wajib disetor perusahaan.
 */
import { accountName, EXPENSE_ACCOUNTS } from '@/data/chartOfAccounts'
import { commit, db } from '@/data/db'
import { respond, NotFoundError, ValidationError } from '@/services/http'
import type {
  Expense,
  ExpenseRow,
  IsoDate,
  NewExpensePayload,
  RankedItem,
  WithholdingType,
} from '@/types'

/** Tarif potongan PPh yang berlaku, dalam persen. */
export const WITHHOLDING_RATE: Record<WithholdingType, number> = {
  none: 0,
  pph21: 3.5,
  pph23: 2,
  'pph4-2': 10,
}

export const WITHHOLDING_LABEL: Record<WithholdingType, string> = {
  none: 'Tanpa potongan',
  pph21: 'PPh 21 — Karyawan',
  pph23: 'PPh 23 — Jasa (2%)',
  'pph4-2': 'PPh Final 4(2) — Sewa (10%)',
}

/** Kas yang benar-benar keluar: nilai beban + PPN, dikurangi PPh yang dipotong. */
export function cashOutOf(expense: Expense): number {
  return expense.amount + expense.ppn - expense.withholdingAmount
}

export function buildExpenseRows(from?: IsoDate, to?: IsoDate): ExpenseRow[] {
  return db()
    .expenses.filter((expense) => (!from || expense.date >= from) && (!to || expense.date <= to))
    .map((expense) => ({
      expense,
      accountName: accountName(expense.accountCode),
      cashOut: cashOutOf(expense),
    }))
    .sort((a, b) => b.expense.date.localeCompare(a.expense.date) || b.expense.number.localeCompare(a.expense.number))
}

/** TODO: replace with real API call — GET /expenses?from=&to= */
export function getExpenseRows(from?: IsoDate, to?: IsoDate): Promise<ExpenseRow[]> {
  return respond(buildExpenseRows(from, to))
}

/** Komposisi beban per akun — dipakai halaman Beban dan Performa. */
export function buildExpenseBreakdown(from: IsoDate, to: IsoDate): RankedItem[] {
  const rows = buildExpenseRows(from, to)
  const byAccount = new Map<string, number>()

  for (const row of rows) {
    byAccount.set(row.expense.accountCode, (byAccount.get(row.expense.accountCode) ?? 0) + row.expense.amount)
  }

  const total = [...byAccount.values()].reduce((sum, value) => sum + value, 0)

  return [...byAccount.entries()]
    .map(([code, value]) => ({
      id: code,
      label: accountName(code),
      sublabel: code,
      value,
      share: total === 0 ? 0 : Number(((value / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.value - a.value)
}

/** TODO: replace with real API call — GET /expenses/breakdown?from=&to= */
export function getExpenseBreakdown(from: IsoDate, to: IsoDate): Promise<RankedItem[]> {
  return respond(buildExpenseBreakdown(from, to))
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Catat beban baru. Nilai PPh dihitung dari tarif — bukan diketik user —
 * supaya potongan pajak tidak pernah meleset dari ketentuan.
 *
 * TODO: replace with real API call — POST /expenses
 */
export function createExpense(payload: NewExpensePayload): Promise<Expense> {
  if (payload.amount <= 0) throw new ValidationError('Nilai beban harus lebih dari nol.')
  if (!EXPENSE_ACCOUNTS.some((account) => account.code === payload.accountCode)) {
    throw new ValidationError('Akun beban tidak dikenali.')
  }

  const withholdingAmount = Math.round((payload.amount * WITHHOLDING_RATE[payload.withholding]) / 100)

  const created = commit((database) => {
    const sequence = database.expenses.length + 1
    const expense: Expense = {
      id: `EXP-${String(sequence).padStart(4, '0')}`,
      number: `EXP-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      date: payload.date,
      accountCode: payload.accountCode,
      description: payload.description,
      amount: payload.amount,
      ppn: payload.ppn,
      withholding: payload.withholding,
      withholdingAmount,
      paidFromAccount: payload.paidFromAccount,
      settlement: null,
      vendor: payload.vendor,
      status: payload.paidFromAccount ? 'paid' : 'posted',
    }
    database.expenses.push(expense)
    return expense
  })

  return respond(created)
}

/**
 * Lunasi beban yang masih terutang.
 *
 * Jurnal pengakuan bebannya TIDAK diutak-atik — pelunasan menghasilkan jurnal
 * kas tersendiri (Beban Masih Harus Dibayar lawan Kas/Bank), persis praktik
 * akrual yang benar.
 *
 * TODO: replace with real API call — POST /expenses/:id/pay
 */
export function payExpense(id: string, accountCode: string, date: IsoDate): Promise<Expense> {
  const expense = db().expenses.find((row) => row.id === id)
  if (!expense) throw new NotFoundError('Beban', id)
  if (expense.status === 'paid') throw new ValidationError('Beban ini sudah dibayar.')

  const updated = commit((database) => {
    const target = database.expenses.find((row) => row.id === id)!
    target.settlement = { date, accountCode }
    target.status = 'paid'
    return target
  })

  return respond(updated)
}
