/**
 * Buku besar & neraca saldo.
 *
 * Semua angka lahir dari `buildJournal()` — tidak ada saldo yang disimpan.
 * Service laporan (neraca, laba rugi, arus kas) memakai primitif di file ini
 * supaya definisi "saldo akun" hanya ada satu di seluruh aplikasi.
 */
import { CHART_OF_ACCOUNTS, accountByCode } from '@/data/chartOfAccounts'
import { buildJournal } from '@/services/postingService'
import { respond } from '@/services/http'
import type {
  Account,
  AccountCode,
  IsoDate,
  JournalEntry,
  LedgerAccount,
  LedgerRow,
  TrialBalance,
  TrialBalanceRow,
} from '@/types'

export interface AccountTotals {
  debit: number
  credit: number
}

/** Akumulasi debit & kredit per akun dari sekumpulan jurnal. */
export function accumulate(entries: JournalEntry[]): Map<AccountCode, AccountTotals> {
  const totals = new Map<AccountCode, AccountTotals>()

  for (const entry of entries) {
    for (const row of entry.lines) {
      const current = totals.get(row.accountCode) ?? { debit: 0, credit: 0 }
      current.debit += row.debit
      current.credit += row.credit
      totals.set(row.accountCode, current)
    }
  }

  return totals
}

/**
 * Saldo bertanda positif menurut saldo normal akun.
 * Akun debit: debit - kredit. Akun kredit: kredit - debit.
 */
export function signedBalance(account: Account, totals: AccountTotals | undefined): number {
  if (!totals) return 0
  return account.normalBalance === 'debit'
    ? totals.debit - totals.credit
    : totals.credit - totals.debit
}

/** Saldo seluruh akun per tanggal tertentu (inklusif). */
export function balancesAsOf(asOf: IsoDate): Map<AccountCode, number> {
  const totals = accumulate(buildJournal().filter((entry) => entry.date <= asOf))
  const result = new Map<AccountCode, number>()

  for (const account of CHART_OF_ACCOUNTS) {
    result.set(account.code, signedBalance(account, totals.get(account.code)))
  }

  return result
}

/** Mutasi bersih tiap akun pada rentang tanggal (untuk laba rugi & arus kas). */
export function mutationsBetween(from: IsoDate, to: IsoDate): Map<AccountCode, number> {
  const totals = accumulate(
    buildJournal().filter((entry) => entry.date >= from && entry.date <= to),
  )
  const result = new Map<AccountCode, number>()

  for (const account of CHART_OF_ACCOUNTS) {
    result.set(account.code, signedBalance(account, totals.get(account.code)))
  }

  return result
}

/* -------------------------------------------------------------------------- */
/* Buku besar                                                                  */
/* -------------------------------------------------------------------------- */

function buildLedgerAccount(account: Account, from: IsoDate, to: IsoDate): LedgerAccount {
  const journal = buildJournal()

  const openingTotals = accumulate(journal.filter((entry) => entry.date < from))
  const openingBalance = signedBalance(account, openingTotals.get(account.code))

  const rows: LedgerRow[] = []
  let balance = openingBalance
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of journal) {
    if (entry.date < from || entry.date > to) continue

    for (const row of entry.lines) {
      if (row.accountCode !== account.code) continue

      totalDebit += row.debit
      totalCredit += row.credit
      balance +=
        account.normalBalance === 'debit' ? row.debit - row.credit : row.credit - row.debit

      rows.push({
        entryId: entry.id,
        number: entry.number,
        date: entry.date,
        description: row.memo || entry.description,
        source: entry.source,
        debit: row.debit,
        credit: row.credit,
        balance,
      })
    }
  }

  return { account, openingBalance, rows, totalDebit, totalCredit, closingBalance: balance }
}

/** TODO: replace with real API call — GET /ledger/:code?from=&to= */
export function getLedgerAccount(code: AccountCode, from: IsoDate, to: IsoDate): Promise<LedgerAccount> {
  return respond(buildLedgerAccount(accountByCode(code), from, to))
}

/**
 * Buku besar seluruh akun yang bergerak atau bersaldo pada periode ini.
 * Akun tidur tidak ikut ditampilkan supaya halaman tetap terbaca.
 */
export function getActiveLedgerAccounts(from: IsoDate, to: IsoDate): Promise<LedgerAccount[]> {
  const ledgers = CHART_OF_ACCOUNTS.map((account) => buildLedgerAccount(account, from, to)).filter(
    (ledger) => ledger.rows.length > 0 || ledger.openingBalance !== 0,
  )

  return respond(ledgers)
}

/* -------------------------------------------------------------------------- */
/* Neraca saldo                                                                */
/* -------------------------------------------------------------------------- */

function buildTrialBalance(from: IsoDate, to: IsoDate): TrialBalance {
  const journal = buildJournal()
  const opening = accumulate(journal.filter((entry) => entry.date < from))
  const mutation = accumulate(
    journal.filter((entry) => entry.date >= from && entry.date <= to),
  )

  const rows: TrialBalanceRow[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const account of CHART_OF_ACCOUNTS) {
    const openingBalance = signedBalance(account, opening.get(account.code))
    const mutationTotals = mutation.get(account.code) ?? { debit: 0, credit: 0 }
    const ending =
      openingBalance +
      (account.normalBalance === 'debit'
        ? mutationTotals.debit - mutationTotals.credit
        : mutationTotals.credit - mutationTotals.debit)

    if (openingBalance === 0 && mutationTotals.debit === 0 && mutationTotals.credit === 0) continue

    const isDebitAccount = account.normalBalance === 'debit'

    const row: TrialBalanceRow = {
      account,
      openingDebit: isDebitAccount ? Math.max(openingBalance, 0) : Math.max(-openingBalance, 0),
      openingCredit: isDebitAccount ? Math.max(-openingBalance, 0) : Math.max(openingBalance, 0),
      mutationDebit: mutationTotals.debit,
      mutationCredit: mutationTotals.credit,
      endingDebit: isDebitAccount ? Math.max(ending, 0) : Math.max(-ending, 0),
      endingCredit: isDebitAccount ? Math.max(-ending, 0) : Math.max(ending, 0),
    }

    totalDebit += row.endingDebit
    totalCredit += row.endingCredit
    rows.push(row)
  }

  return { rows, totalDebit, totalCredit, difference: totalDebit - totalCredit }
}

/** TODO: replace with real API call — GET /reports/trial-balance?from=&to= */
export function getTrialBalance(from: IsoDate, to: IsoDate): Promise<TrialBalance> {
  return respond(buildTrialBalance(from, to))
}

/** Versi sinkron untuk dipakai service lain. */
export { buildTrialBalance }
