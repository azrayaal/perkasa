/**
 * Mesin posting | jantung integrasi Perkasa ERP.
 *
 * Tidak ada satu pun jurnal yang disimpan di database (kecuali jurnal manual
 * yang memang diketik akuntan). Seluruh jurnal DITURUNKAN dari dokumen setiap
 * kali dibaca, memakai aturan di bawah:
 *
 *   Transaksi kasir   -> Kas Kasir atau Piutang Settlement / Penjualan + PPN
 *   Tutup shift       -> Bank / Kas Kasir, selisih hitung ke akun Selisih Kas
 *   Faktur penjualan  -> Piutang / Penjualan + PPN Keluaran, plus HPP / Persediaan
 *   Faktur pembelian  -> Persediaan + PPN Masukan / Utang Usaha
 *   Beban             -> Beban (+PPN Masukan) / Kas atau Utang, dipotong PPh
 *   Bukti kas masuk   -> Kas / Piutang
 *   Bukti kas keluar  -> Utang / Kas
 *   Selisih opname    -> Selisih Persediaan / Persediaan
 *
 * Efeknya: mengubah satu faktur otomatis mengubah buku besar, neraca saldo,
 * neraca, laba rugi, arus kas, dan modul pajak | tanpa proses "posting" manual
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
  PosShift,
  PosTransaction,
  PurchaseInvoice,
  SalesInvoice,
  StockAdjustment,
} from '@/types'

/** Urutan penyajian jurnal dalam satu hari yang sama. */
const SOURCE_ORDER: Record<JournalEntry['source'], number> = {
  opening: 0,
  purchase: 1,
  sales: 2,
  pos: 3,
  expense: 4,
  payment: 5,
  inventory: 6,
  manual: 7,
}

function line(accountCode: string, debit: number, credit: number, memo: string): JournalLine {
  return { accountCode, debit, credit, memo }
}

/* -------------------------------------------------------------------------- */
/* Aturan posting per dokumen                                                  */
/* -------------------------------------------------------------------------- */

function postSalesInvoice(
  invoice: SalesInvoice,
  customerName: string,
  /** Harga pokok standar tiap SKU, untuk menilai barang bekas yang masuk. */
  standardCost: Map<string, number>,
): JournalEntry | null {
  // Draft belum menjadi transaksi | tidak menyentuh buku sama sekali.
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

  /*
   * Tukar tambah: barang bekas masuk gudang dan langsung memotong piutang.
   *
   * Persediaan didebit sebesar HARGA POKOK STANDAR SKU bekas | bukan nilai yang
   * dinegosiasi | supaya saldo akun 1300 tetap sama persis dengan nilai kartu
   * stok (yang juga memakai biaya standar). Selisih tawar-menawarnya diakui
   * sebagai untung/rugi penilaian di akun 5300, bukan disembunyikan.
   */
  if (invoice.tradeIn) {
    const { tradeIn } = invoice

    const standardValue = tradeIn.lines.reduce(
      (sum, row) => sum + row.qty * (standardCost.get(row.productId) ?? 0),
      0,
    )
    const variance = tradeIn.dpp - standardValue

    lines.push(line(ACC.inventory, standardValue, 0, 'Barang bekas tukar tambah masuk gudang'))

    if (variance !== 0) {
      lines.push(
        variance > 0
          ? line(ACC.usedGoodsVariance, variance, 0, 'Nilai tukar tambah di atas harga pokok standar')
          : line(ACC.usedGoodsVariance, 0, -variance, 'Nilai tukar tambah di bawah harga pokok standar'),
      )
    }

    if (tradeIn.ppn > 0) {
      lines.push(line(ACC.vatIn, tradeIn.ppn, 0, 'PPN masukan atas penyerahan barang bekas'))
    }

    lines.push(
      line(ACC.receivable, 0, tradeIn.total, `Potongan tukar tambah dari ${customerName}`),
    )
  }

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

/**
 * Transaksi kasir.
 *
 * Bedanya dengan faktur bertermin hanya pada sisi debitnya: uang sudah diterima,
 * jadi yang didebit adalah kas laci (tunai) atau piutang penyelenggara
 * pembayaran (QRIS/debit) | bukan piutang usaha. Sisanya identik, termasuk
 * pengakuan HPP dan perlakuan tukar tambah.
 */
function postPosTransaction(
  transaction: PosTransaction,
  standardCost: Map<string, number>,
): JournalEntry {
  const lines: JournalLine[] = []

  if (transaction.type === 'buy') {
    /*
     * Beli barang bekas di konter: barang masuk, uang laci keluar.
     *
     * Sama seperti tukar tambah, persediaan didebit sebesar HARGA POKOK STANDAR
     * | bukan harga tebus yang ditawar di tempat | supaya saldo akun 1300 tetap
     * sama persis dengan nilai kartu stok. Selisih tawar-menawarnya jadi
     * untung/rugi penilaian di akun 5300.
     */
    const standardValue = transaction.lines.reduce(
      (sum, row) => sum + row.qty * (standardCost.get(row.productId) ?? 0),
      0,
    )
    const variance = transaction.totals.total - standardValue

    lines.push(line(ACC.inventory, standardValue, 0, 'Pembelian barang bekas di konter'))

    if (variance !== 0) {
      lines.push(
        variance > 0
          ? line(ACC.usedGoodsVariance, variance, 0, 'Harga tebus di atas harga pokok standar')
          : line(ACC.usedGoodsVariance, 0, -variance, 'Harga tebus di bawah harga pokok standar'),
      )
    }

    lines.push(
      line(ACC.cashRegister, 0, transaction.totals.total, `Pembayaran tunai ke ${transaction.customerName}`),
    )

    return {
      id: `JE-${transaction.id}`,
      number: '',
      date: transaction.date,
      description: `Pembelian barang bekas — ${transaction.customerName}`,
      source: 'pos',
      refId: transaction.id,
      refNumber: transaction.number,
      lines,
    }
  }

  /*
   * Dana QRIS & debit belum menjadi kas: penyelenggara mencairkannya H+1
   * dikurangi MDR. Mengakuinya langsung sebagai kas akan membuat saldo bank di
   * neraca lebih besar daripada rekening koran yang sesungguhnya.
   */
  if (transaction.method === 'tunai') {
    lines.push(line(ACC.cashRegister, transaction.netDue, 0, 'Penerimaan tunai di kasir'))
  } else {
    const settlement = transaction.netDue - transaction.mdrFee
    lines.push(
      line(ACC.paymentGatewayReceivable, settlement, 0, `Tagihan settlement ${transaction.method.toUpperCase()}`),
    )
    if (transaction.mdrFee > 0) {
      lines.push(line(ACC.mdrFee, transaction.mdrFee, 0, 'Potongan MDR penyelenggara pembayaran'))
    }
  }

  if (transaction.totals.discount > 0) {
    lines.push(line(ACC.salesDiscount, transaction.totals.discount, 0, 'Diskon penjualan konter'))
  }

  lines.push(
    line(ACC.sales, 0, transaction.totals.gross, 'Penjualan barang dagang (konter)'),
    line(ACC.vatOut, 0, transaction.totals.ppn, `PPN keluaran ${db().company.vatRate}%`),
    line(ACC.cogs, transaction.cogs, 0, 'Harga pokok barang terjual'),
    line(ACC.inventory, 0, transaction.cogs, 'Pengeluaran barang dari gudang'),
  )

  // Tukar tambah di konter | aturannya sama persis dengan faktur bertermin.
  if (transaction.tradeIn) {
    const { tradeIn } = transaction

    const standardValue = tradeIn.lines.reduce(
      (sum, row) => sum + row.qty * (standardCost.get(row.productId) ?? 0),
      0,
    )
    const variance = tradeIn.dpp - standardValue

    lines.push(line(ACC.inventory, standardValue, 0, 'Barang bekas tukar tambah masuk gudang'))

    if (variance !== 0) {
      lines.push(
        variance > 0
          ? line(ACC.usedGoodsVariance, variance, 0, 'Nilai tukar tambah di atas harga pokok standar')
          : line(ACC.usedGoodsVariance, 0, -variance, 'Nilai tukar tambah di bawah harga pokok standar'),
      )
    }

    if (tradeIn.ppn > 0) {
      lines.push(line(ACC.vatIn, tradeIn.ppn, 0, 'PPN masukan atas penyerahan barang bekas'))
    }
  }

  return {
    id: `JE-${transaction.id}`,
    number: '',
    date: transaction.date,
    description: `Penjualan konter — ${transaction.customerName}`,
    source: 'pos',
    refId: transaction.id,
    refNumber: transaction.number,
    lines,
  }
}

/**
 * Pembukaan shift: modal kas awal dipindahkan dari bank ke laci kasir.
 * Uangnya tidak bertambah, hanya berpindah tempat | tapi tanpa jurnal ini,
 * saldo akun 1130 tidak akan pernah cocok dengan uang fisik di laci.
 */
function postShiftOpening(shift: PosShift): JournalEntry | null {
  if (shift.openingFloat <= 0) return null

  return {
    id: `JE-${shift.id}-OPEN`,
    number: '',
    date: shift.date,
    description: `Modal kas awal shift ${shift.cashierName}`,
    source: 'pos',
    refId: shift.id,
    refNumber: shift.number,
    lines: [
      line(ACC.cashRegister, shift.openingFloat, 0, 'Pengisian laci kasir'),
      line(ACC.bankOps, 0, shift.openingFloat, 'Penarikan modal kas dari bank'),
    ],
  }
}

/**
 * Penutupan shift: setoran ke bank dan pengakuan selisih hitung fisik.
 *
 * Selisih kas TIDAK boleh dibulatkan diam-diam. Kalau laci kurang, ia menjadi
 * beban; kalau lebih, ia menjadi pendapatan | keduanya lewat akun 7200 supaya
 * pola kebocoran kasir terlihat di Laba Rugi.
 */
function postShiftClosing(shift: PosShift, expectedCash: number): JournalEntry | null {
  if (shift.status !== 'closed' || shift.countedCash === null) return null

  const difference = shift.countedCash - expectedCash
  const lines: JournalLine[] = []

  if (shift.depositedAmount > 0) {
    lines.push(
      line(ACC.bankOps, shift.depositedAmount, 0, 'Setoran hasil penjualan konter'),
      line(ACC.cashRegister, 0, shift.depositedAmount, 'Pengeluaran uang dari laci kasir'),
    )
  }

  if (difference !== 0) {
    lines.push(
      difference < 0
        ? line(ACC.cashVariance, -difference, 0, 'Selisih kurang hitung fisik laci')
        : line(ACC.cashVariance, 0, difference, 'Selisih lebih hitung fisik laci'),
      difference < 0
        ? line(ACC.cashRegister, 0, -difference, 'Koreksi saldo laci kasir')
        : line(ACC.cashRegister, difference, 0, 'Koreksi saldo laci kasir'),
    )
  }

  if (lines.length === 0) return null

  return {
    id: `JE-${shift.id}-CLOSE`,
    number: '',
    date: shift.date,
    description: `Tutup shift kasir ${shift.cashierName}`,
    source: 'pos',
    refId: shift.id,
    refNumber: shift.number,
    lines,
  }
}

/**
 * Pencairan dana non-tunai oleh penyelenggara pembayaran (H+1).
 *
 * Tanpa jurnal ini, akun 1250 akan menggelembung terus dan neraca menyiratkan
 * perusahaan punya tagihan miliaran ke penyelenggara | padahal uangnya sudah
 * lama masuk rekening.
 */
function postShiftSettlement(shift: PosShift, netSettlement: number): JournalEntry | null {
  if (!shift.settledAt || netSettlement <= 0) return null

  return {
    id: `JE-${shift.id}-SETTLE`,
    number: '',
    date: shift.settledAt,
    description: `Pencairan dana QRIS & debit shift ${shift.number}`,
    source: 'pos',
    refId: shift.id,
    refNumber: shift.number,
    lines: [
      line(ACC.bankOps, netSettlement, 0, 'Dana non-tunai masuk rekening'),
      line(ACC.paymentGatewayReceivable, 0, netSettlement, 'Penyelesaian tagihan penyelenggara'),
    ],
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

/** Pelunasan beban yang tadinya diakui sebagai utang | jurnal kas tersendiri. */
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
 * jadi tidak dibungkus `respond()` | pembungkus async ada di service pemanggil.
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

  const standardCost = new Map(database.products.map((row) => [row.id, row.cost]))

  for (const invoice of database.salesInvoices) {
    const entry = postSalesInvoice(
      invoice,
      customerName.get(invoice.customerId) ?? 'Pelanggan',
      standardCost,
    )
    if (entry) entries.push(entry)
  }

  for (const invoice of database.purchaseInvoices) {
    entries.push(postPurchaseInvoice(invoice, supplierName.get(invoice.supplierId) ?? 'Pemasok'))
  }

  /*
   * POS. `expectedCash` dihitung di sini | bukan diambil dari kolom tersimpan |
   * supaya jurnal selisih kas selalu mencerminkan transaksi shift yang
   * sebenarnya, termasuk bila ada transaksi yang disisipkan belakangan.
   */
  for (const transaction of database.posTransactions) {
    entries.push(postPosTransaction(transaction, standardCost))
  }

  for (const shift of database.posShifts) {
    const opening = postShiftOpening(shift)
    if (opening) entries.push(opening)

    const shiftRows = database.posTransactions.filter((row) => row.shiftId === shift.id)
    const cashIn = shiftRows
      .filter((row) => row.type === 'sale' && row.method === 'tunai')
      .reduce((sum, row) => sum + row.netDue, 0)
    const cashOut = shiftRows
      .filter((row) => row.type === 'buy')
      .reduce((sum, row) => sum + row.totals.total, 0)

    const closing = postShiftClosing(shift, shift.openingFloat + cashIn - cashOut)
    if (closing) entries.push(closing)

    // Yang dicairkan adalah nilai bersih setelah MDR | itulah yang benar-benar
    // masuk rekening, dan itu pula yang tadi didebit ke akun 1250.
    const settlement = shiftRows
      .filter((row) => row.type === 'sale' && row.method !== 'tunai')
      .reduce((sum, row) => sum + row.netDue - row.mdrFee, 0)

    const settled = postShiftSettlement(shift, settlement)
    if (settled) entries.push(settled)
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

/** Jurnal yang lahir dari satu dokumen | dipakai panel "Jurnal Otomatis". */
export function journalForDocument(documentId: string): JournalEntry[] {
  return buildJournal().filter((entry) => entry.refId === documentId)
}

/** Total debit satu entri; dipakai UI untuk menampilkan nilai transaksi. */
export function entryAmount(entry: JournalEntry): number {
  return entry.lines.reduce((sum, row) => sum + row.debit, 0)
}
