/**
 * Dashboard — ringkasan lintas modul.
 *
 * Tidak ada agregasi baru di sini: setiap angka diambil dari service modulnya
 * masing-masing. Dashboard hanyalah jendela, bukan sumber kebenaran kedua.
 */
import { CHART_OF_ACCOUNTS, ACC } from '@/data/chartOfAccounts'
import { db } from '@/data/db'
import { today } from '@/services/clock'
import { respond } from '@/services/http'
import { buildPositions } from '@/services/inventoryService'
import { balancesAsOf } from '@/services/ledgerService'
import { buildJournal, entryAmount } from '@/services/postingService'
import { buildIncomeStatement } from '@/services/reportService'
import { buildSalesRows } from '@/services/salesService'
import { addDays, daysBetween } from '@/utils/date'
import { ROUTE } from '@/router/routeNames'
import type { DashboardStats, IsoDate, JournalSource, TimelineEntry } from '@/types'

function growth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

/** TODO: replace with real API call — GET /dashboard/stats?from=&to= */
export function getDashboardStats(from: IsoDate, to: IsoDate): Promise<DashboardStats> {
  const income = buildIncomeStatement(from, to)

  // Pembanding: periode sepanjang periode berjalan, tepat sebelum periode ini.
  const span = daysBetween(from, to)
  const previous = buildIncomeStatement(addDays(from, -span - 1), addDays(from, -1))

  const balances = balancesAsOf(to)
  const cashBalance = CHART_OF_ACCOUNTS.filter((account) => account.cash).reduce(
    (sum, account) => sum + (balances.get(account.code) ?? 0),
    0,
  )

  const salesRows = buildSalesRows()
  const positions = buildPositions(to)

  return respond({
    revenue: income.revenue.total,
    revenueGrowth: growth(income.revenue.total, previous.revenue.total),
    grossProfit: income.grossProfit,
    netProfit: income.netProfit,
    netMargin: income.netMargin,
    cashBalance,
    receivable: balances.get(ACC.receivable) ?? 0,
    payable: balances.get(ACC.payable) ?? 0,
    inventoryValue: balances.get(ACC.inventory) ?? 0,
    overdueReceivable: salesRows
      .filter((row) => row.status === 'overdue')
      .reduce((sum, row) => sum + row.outstanding, 0),
    vatPayable: (balances.get(ACC.vatOut) ?? 0) - (balances.get(ACC.vatIn) ?? 0),
    lowStockCount: positions.filter((position) => position.status !== 'in-stock').length,
    draftCount: salesRows.filter((row) => row.status === 'draft').length,
  })
}

/** Route tujuan tiap jenis peristiwa — supaya linimasa bisa diklik. */
const SOURCE_ROUTE: Record<JournalSource, string | null> = {
  opening: null,
  sales: ROUTE.salesDetail,
  purchase: ROUTE.purchaseDetail,
  expense: ROUTE.expenses,
  payment: ROUTE.journal,
  inventory: ROUTE.inventory,
  manual: ROUTE.journal,
}

const SOURCE_TITLE: Record<JournalSource, string> = {
  opening: 'Saldo awal tahun buku',
  sales: 'Faktur penjualan',
  purchase: 'Faktur pembelian',
  expense: 'Beban operasional',
  payment: 'Mutasi kas & bank',
  inventory: 'Penyesuaian gudang',
  manual: 'Jurnal manual',
}

/**
 * Linimasa lintas modul: penjualan, pembelian, beban, kas, dan gudang dalam
 * satu aliran. Sumbernya jurnal — jadi tidak mungkin ada transaksi yang
 * tercatat di buku tapi hilang dari linimasa.
 *
 * TODO: replace with real API call — GET /dashboard/timeline
 */
export function getRecentTimeline(limit = 10): Promise<TimelineEntry[]> {
  const entries = buildJournal()
    .filter((entry) => entry.source !== 'opening' && entry.date <= today())
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
    .slice(0, limit)
    .map<TimelineEntry>((entry) => ({
      id: entry.id,
      source: entry.source,
      title: SOURCE_TITLE[entry.source],
      subtitle: entry.refNumber ? `${entry.refNumber} · ${entry.description}` : entry.description,
      amount: entryAmount(entry),
      date: entry.date,
      routeName: SOURCE_ROUTE[entry.source],
      routeParams:
        entry.source === 'sales' || entry.source === 'purchase'
          ? { id: entry.refId ?? '' }
          : null,
    }))

  return respond(entries)
}

/** Faktur yang paling mendesak ditagih — kartu "perlu tindak lanjut". */
export function getOverdueInvoices(limit = 5): Promise<
  Array<{ id: string; number: string; customerName: string; outstanding: number; overdueDays: number }>
> {
  const rows = buildSalesRows()
    .filter((row) => row.status === 'overdue')
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, limit)
    .map((row) => ({
      id: row.invoice.id,
      number: row.invoice.number,
      customerName: row.customerName,
      outstanding: row.outstanding,
      overdueDays: row.overdueDays,
    }))

  return respond(rows)
}

/**
 * Uji konsistensi lintas modul — ditampilkan di dashboard sebagai bukti bahwa
 * modul-modulnya benar-benar satu sumber, bukan tiga aplikasi yang ditempel.
 */
export interface IntegrityCheck {
  key: string
  label: string
  moduleValue: number
  ledgerValue: number
  difference: number
  moduleLabel: string
  ledgerLabel: string
}

/** TODO: replace with real API call — GET /dashboard/integrity */
export function getIntegrityChecks(asOf: IsoDate = today()): Promise<IntegrityCheck[]> {
  const balances = balancesAsOf(asOf)
  const database = db()

  const inventoryFromStockCard = buildPositions(asOf).reduce((sum, position) => sum + position.value, 0)

  const receivableFromInvoices = database.salesInvoices
    .filter((invoice) => invoice.status !== 'draft' && invoice.date <= asOf)
    .reduce((sum, invoice) => sum + invoice.totals.total - invoice.paidAmount, 0)

  const payableFromInvoices = database.purchaseInvoices
    .filter((invoice) => invoice.date <= asOf)
    .reduce((sum, invoice) => sum + invoice.totals.total - invoice.paidAmount, 0)

  const checks: IntegrityCheck[] = [
    {
      key: 'inventory',
      label: 'Nilai persediaan',
      moduleValue: inventoryFromStockCard,
      ledgerValue: balances.get(ACC.inventory) ?? 0,
      difference: inventoryFromStockCard - (balances.get(ACC.inventory) ?? 0),
      moduleLabel: 'Kartu stok gudang',
      ledgerLabel: 'Akun 1300 di Neraca',
    },
    {
      key: 'receivable',
      label: 'Piutang usaha',
      moduleValue: receivableFromInvoices,
      ledgerValue: balances.get(ACC.receivable) ?? 0,
      difference: receivableFromInvoices - (balances.get(ACC.receivable) ?? 0),
      moduleLabel: 'Faktur penjualan belum lunas',
      ledgerLabel: 'Akun 1200 di Neraca',
    },
    {
      key: 'payable',
      label: 'Utang usaha',
      moduleValue: payableFromInvoices,
      ledgerValue: balances.get(ACC.payable) ?? 0,
      difference: payableFromInvoices - (balances.get(ACC.payable) ?? 0),
      moduleLabel: 'Faktur pembelian belum lunas',
      ledgerLabel: 'Akun 2100 di Neraca',
    },
  ]

  return respond(checks)
}
