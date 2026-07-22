/**
 * Mesin posting — jantung integrasi Perkasa ERP.
 *
 * Tidak ada satu pun jurnal yang disimpan di database (kecuali jurnal manual
 * yang memang diketik akuntan). Seluruh jurnal DITURUNKAN dari dokumen setiap
 * kali dibaca, memakai aturan di bawah:
 *
 *   Faktur penjualan  -> Piutang / Penjualan + PPN Keluaran, plus HPP / Persediaan
 *   Faktur pembelian  -> Persediaan + PPN Masukan / Utang Usaha
 *   Beban             -> Beban (+PPN Masukan) / Kas atau Utang, dipotong PPh
 *   Bukti kas masuk   -> Kas / Piutang
 *   Bukti kas keluar  -> Utang / Kas
 *   Selisih opname    -> Selisih Persediaan / Persediaan
 *
 * Efeknya: mengubah satu faktur otomatis mengubah buku besar, neraca saldo,
 * neraca, laba rugi, arus kas, dan modul pajak — tanpa proses "posting" manual
 * yang bisa terlupa.
 */
import { ACC, accountName } from '@/data/chartOfAccounts'
import { db } from '@/data/db'
import type {
  Expense,
  IsoDate,
  JournalEntry,
  JournalLine,
  Payment,
  PurchaseInvoice,
  SalesInvoice,
  StockAdjustment,
} from '@/types'

/** Urutan penyajian jurnal dalam satu hari yang sama. */
const SOURCE_ORDER: Record<JournalEntry['source'], number> = {
  opening: 0,
  purchase: 1,
  sales: 2,
  expense: 3,
  payment: 4,
  inventory: 5,
  manual: 6,
}

function line(accountCode: string, debit: number, credit: number, memo: string): JournalLine {
  return { accountCode, debit, credit, memo }
}

/* -------------------------------------------------------------------------- */
/* Aturan posting per dokumen                                                  */
/* -------------------------------------------------------------------------- */

function postSalesInvoice(invoice: SalesInvoice, customerName: string): JournalEntry | null {
  // Draft belum menjadi transaksi — tidak menyentuh buku sama sekali.
  if (invoice.status === 'draft') return null

  const lines: JournalLine[] = [
    line(ACC.receivable, invoice.totals.total, 0, `Piutang ${customerName}`),
  ]

  if (invoice.totals.discount > 0) {
    lines.push(line(ACC.salesDiscount, invoice.totals.discount, 0, 'Diskon penjualan'))
  }

  lines.push(
    line(ACC.sales, 0, invoice.totals.gross, 'Penjualan barang dagang'),
    line(ACC.vatOut, 0, invoice.totals.ppn, `PPN keluaran ${db().company.vatRate}%`),
    // Harga pokok diakui bersamaan dengan pendapatannya (matching principle).
    line(ACC.cogs, invoice.cogs, 0, 'Harga pokok barang terjual'),
    line(ACC.inventory, 0, invoice.cogs, 'Pengeluaran barang dari gudang'),
  )

  return {
    id: `JE-${invoice.id}`,
    number: '',
    date: invoice.date,
    description: `Penjualan kepada ${customerName}`,
    source: 'sales',
    refId: invoice.id,
    refNumber: invoice.number,
    lines,
  }
}

function postPurchaseInvoice(invoice: PurchaseInvoice, supplierName: string): JournalEntry {
  const lines: JournalLine[] = [
    line(ACC.inventory, invoice.totals.dpp, 0, 'Penerimaan barang ke gudang'),
  ]

  if (invoice.totals.ppn > 0) {
    lines.push(line(ACC.vatIn, invoice.totals.ppn, 0, 'PPN masukan dapat dikreditkan'))
  }

  lines.push(line(ACC.payable, 0, invoice.totals.total, `Utang kepada ${supplierName}`))

  return {
    id: `JE-${invoice.id}`,
    number: '',
    date: invoice.date,
    description: `Pembelian dari ${supplierName}`,
    source: 'purchase',
    refId: invoice.id,
    refNumber: invoice.number,
    lines,
  }
}

/** Akun utang PPh sesuai jenis potongan. */
const WITHHOLDING_ACCOUNT: Record<Expense['withholding'], string | null> = {
  none: null,
  pph21: ACC.pph21,
  pph23: ACC.pph23,
  'pph4-2': ACC.pph4Final,
}

function postExpense(expense: Expense): JournalEntry {
  const lines: JournalLine[] = [
    line(expense.accountCode, expense.amount, 0, accountName(expense.accountCode)),
  ]

  if (expense.ppn > 0) {
    lines.push(line(ACC.vatIn, expense.ppn, 0, 'PPN masukan atas beban'))
  }

  const withholdingAccount = WITHHOLDING_ACCOUNT[expense.withholding]
  if (withholdingAccount && expense.withholdingAmount > 0) {
    lines.push(
      line(withholdingAccount, 0, expense.withholdingAmount, 'Potongan PPh atas pembayaran'),
    )
  }

  // Yang keluar dari kas adalah nilai bruto dikurangi pajak yang dipotong.
  const settlement = expense.amount + expense.ppn - expense.withholdingAmount

  lines.push(
    expense.paidFromAccount
      ? line(expense.paidFromAccount, 0, settlement, `Pembayaran ke ${expense.vendor}`)
      : line(ACC.accrued, 0, settlement, `Terutang kepada ${expense.vendor}`),
  )

  return {
    id: `JE-${expense.id}`,
    number: '',
    date: expense.date,
    description: expense.description,
    source: 'expense',
    refId: expense.id,
    refNumber: expense.number,
    lines,
  }
}

/** Pelunasan beban yang tadinya diakui sebagai utang — jurnal kas tersendiri. */
function postExpenseSettlement(expense: Expense): JournalEntry | null {
  if (!expense.settlement) return null

  const settlement = expense.amount + expense.ppn - expense.withholdingAmount

  return {
    id: `JE-${expense.id}-PAY`,
    number: '',
    date: expense.settlement.date,
    description: `Pelunasan beban — ${expense.description}`,
    source: 'payment',
    refId: expense.id,
    refNumber: expense.number,
    lines: [
      line(ACC.accrued, settlement, 0, `Pelunasan kepada ${expense.vendor}`),
      line(expense.settlement.accountCode, 0, settlement, 'Pengeluaran kas/bank'),
    ],
  }
}

function postPayment(payment: Payment, partnerName: string, invoiceNumber: string): JournalEntry {
  const lines: JournalLine[] =
    payment.direction === 'in'
      ? [
          line(payment.accountCode, payment.amount, 0, `Penerimaan dari ${partnerName}`),
          line(ACC.receivable, 0, payment.amount, `Pelunasan ${invoiceNumber}`),
        ]
      : [
          line(ACC.payable, payment.amount, 0, `Pelunasan ${invoiceNumber}`),
          line(payment.accountCode, 0, payment.amount, `Pembayaran ke ${partnerName}`),
        ]

  return {
    id: `JE-${payment.id}`,
    number: '',
    date: payment.date,
    description:
      payment.direction === 'in'
        ? `Penerimaan piutang — ${partnerName}`
        : `Pembayaran utang — ${partnerName}`,
    source: 'payment',
    refId: payment.invoiceId,
    refNumber: payment.number,
    lines,
  }
}

function postStockAdjustment(adjustment: StockAdjustment, productName: string, unitCost: number): JournalEntry {
  const value = Math.abs(adjustment.qtyDiff) * unitCost
  const isShrinkage = adjustment.qtyDiff < 0

  return {
    id: `JE-${adjustment.id}`,
    number: '',
    date: adjustment.date,
    description: `Penyesuaian stok — ${productName}`,
    source: 'inventory',
    refId: adjustment.id,
    refNumber: adjustment.number,
    lines: isShrinkage
      ? [
          line(ACC.inventoryVariance, value, 0, 'Selisih kurang hasil opname'),
          line(ACC.inventory, 0, value, 'Koreksi nilai persediaan'),
        ]
      : [
          line(ACC.inventory, value, 0, 'Koreksi nilai persediaan'),
          line(ACC.inventoryVariance, 0, value, 'Selisih lebih hasil opname'),
        ],
  }
}

/* -------------------------------------------------------------------------- */
/* Buku jurnal lengkap                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Seluruh jurnal aplikasi, urut tanggal dan sudah bernomor.
 *
 * Sinkron: fungsi ini dipanggil service lain (buku besar, neraca, laporan),
 * jadi tidak dibungkus `respond()` — pembungkus async ada di service pemanggil.
 */
export function buildJournal(): JournalEntry[] {
  const database = db()

  const customerName = new Map(database.customers.map((row) => [row.id, row.name]))
  const supplierName = new Map(database.suppliers.map((row) => [row.id, row.name]))
  const productById = new Map(database.products.map((row) => [row.id, row]))

  const entries: JournalEntry[] = []

  /* Saldo awal tahun buku. */
  const openingLines = database.openingBalances
    .filter((balance) => balance.debit > 0 || balance.credit > 0)
    .map((balance) => line(balance.code, balance.debit, balance.credit, 'Saldo awal tahun buku'))

  if (openingLines.length > 0) {
    entries.push({
      id: 'JE-OPENING',
      number: '',
      date: `${database.company.fiscalYear - 1}-12-31`,
      description: `Saldo awal per 31 Desember ${database.company.fiscalYear - 1}`,
      source: 'opening',
      refId: null,
      refNumber: null,
      lines: openingLines,
    })
  }

  for (const invoice of database.salesInvoices) {
    const entry = postSalesInvoice(invoice, customerName.get(invoice.customerId) ?? 'Pelanggan')
    if (entry) entries.push(entry)
  }

  for (const invoice of database.purchaseInvoices) {
    entries.push(postPurchaseInvoice(invoice, supplierName.get(invoice.supplierId) ?? 'Pemasok'))
  }

  for (const expense of database.expenses) {
    entries.push(postExpense(expense))
    const settlement = postExpenseSettlement(expense)
    if (settlement) entries.push(settlement)
  }

  const salesById = new Map(database.salesInvoices.map((row) => [row.id, row]))
  const purchaseById = new Map(database.purchaseInvoices.map((row) => [row.id, row]))

  for (const payment of database.payments) {
    if (payment.direction === 'in') {
      const invoice = salesById.get(payment.invoiceId)
      if (!invoice) continue
      entries.push(
        postPayment(payment, customerName.get(invoice.customerId) ?? 'Pelanggan', invoice.number),
      )
    } else {
      const invoice = purchaseById.get(payment.invoiceId)
      if (!invoice) continue
      entries.push(
        postPayment(payment, supplierName.get(invoice.supplierId) ?? 'Pemasok', invoice.number),
      )
    }
  }

  for (const adjustment of database.stockAdjustments) {
    const product = productById.get(adjustment.productId)
    entries.push(
      postStockAdjustment(adjustment, product?.name ?? 'Produk', product?.cost ?? 0),
    )
  }

  for (const journal of database.manualJournals) {
    entries.push({
      id: `JE-${journal.id}`,
      number: '',
      date: journal.date,
      description: journal.description,
      source: 'manual',
      refId: journal.id,
      refNumber: journal.number,
      lines: journal.lines,
    })
  }

  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      (a.refNumber ?? '').localeCompare(b.refNumber ?? ''),
  )

  // Penomoran mengikuti urutan tanggal, seperti buku jurnal fisik.
  const year = database.company.fiscalYear
  entries.forEach((entry, index) => {
    entry.number = `JRN-${year}-${String(index + 1).padStart(4, '0')}`
  })

  return entries
}

/** Jurnal pada rentang tanggal tertentu (inklusif). */
export function journalBetween(from: IsoDate, to: IsoDate): JournalEntry[] {
  return buildJournal().filter((entry) => entry.date >= from && entry.date <= to)
}

/** Jurnal yang lahir dari satu dokumen — dipakai panel "Jurnal Otomatis". */
export function journalForDocument(documentId: string): JournalEntry[] {
  return buildJournal().filter((entry) => entry.refId === documentId)
}

/** Total debit satu entri; dipakai UI untuk menampilkan nilai transaksi. */
export function entryAmount(entry: JournalEntry): number {
  return entry.lines.reduce((sum, row) => sum + row.debit, 0)
}
