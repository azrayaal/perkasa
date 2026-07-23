/**
 * Modul POS (Point of Sale) | terminal kasir konter.
 *
 * Berbeda dari faktur penjualan yang bertermin, transaksi kasir selesai saat
 * itu juga: tidak ada draft, tidak ada jatuh tempo, dan uangnya langsung
 * berpindah. Karena itu dokumennya berdiri sendiri (`PosTransaction`), bukan
 * menumpang `SalesInvoice` yang punya piutang dan termin.
 *
 * Yang TIDAK berbeda: seluruhnya tetap mengalir ke buku besar lewat mesin
 * posting yang sama. Omzet kasir muncul di akun 4100 bersama penjualan
 * bertermin, PPN keluarannya masuk SPT masa yang sama, dan barangnya keluar
 * dari kartu stok gudang yang sama.
 *
 * Tiga hal yang membuat POS lebih dari sekadar form penjualan cepat:
 *   1. SHIFT   | uang fisik di laci selalu ada penanggung jawabnya.
 *   2. SETTLEMENT | QRIS/debit bukan kas; dananya mengendap di penyelenggara.
 *   3. SELISIH KAS | hitung fisik yang meleset diakui sebagai untung/rugi.
 */
import { commit, db } from '@/data/db'
import { today } from '@/services/clock'
import { NotFoundError, respond, ValidationError } from '@/services/http'
import { onHand } from '@/services/inventoryService'
import { journalForDocument } from '@/services/postingService'
import { calcTotals } from '@/utils/documentTotals'
import type {
  ClosePosShiftPayload,
  DocumentLine,
  IsoDate,
  JournalEntry,
  NewPosShiftPayload,
  NewPosTransactionPayload,
  PosPaymentMethod,
  PosShift,
  PosShiftSummary,
  PosTransaction,
  TradeIn,
} from '@/types'
import { EMPTY } from '@/utils/placeholder'

/**
 * Potongan penyelenggara pembayaran (Merchant Discount Rate), dalam persen.
 * Tunai tidak dipotong; itulah alasan konter masih menyukai uang fisik.
 */
export const MDR_RATE: Record<PosPaymentMethod, number> = {
  tunai: 0,
  qris: 0.7,
  debit: 0.15,
}

export const METHOD_LABEL: Record<PosPaymentMethod, string> = {
  tunai: 'Tunai',
  qris: 'QRIS',
  debit: 'Kartu Debit',
}

function mdrOf(method: PosPaymentMethod, amount: number): number {
  return Math.round((amount * MDR_RATE[method]) / 100)
}

/* -------------------------------------------------------------------------- */
/* Shift kasir                                                                 */
/* -------------------------------------------------------------------------- */

/** Transaksi milik satu shift. */
export function transactionsOfShift(shiftId: string): PosTransaction[] {
  return db()
    .posTransactions.filter((row) => row.shiftId === shiftId)
    .sort((a, b) => a.time.localeCompare(b.time) || a.number.localeCompare(b.number))
}

/**
 * Ringkasan shift | dasar laporan tutup kasir.
 *
 * `expectedCash` sengaja dihitung ulang dari transaksi, bukan disimpan: kalau
 * ada transaksi yang dibatalkan atau disisipkan, angka harapannya ikut berubah
 * dan selisih kasnya tetap jujur.
 */
export function buildShiftSummary(shift: PosShift): PosShiftSummary {
  const rows = transactionsOfShift(shift.id)
  const sales = rows.filter((row) => row.type === 'sale')
  const purchases = rows.filter((row) => row.type === 'buy')

  const cashSales = sales
    .filter((row) => row.method === 'tunai')
    .reduce((sum, row) => sum + row.netDue, 0)

  const nonCashSales = sales
    .filter((row) => row.method !== 'tunai')
    .reduce((sum, row) => sum + row.netDue, 0)

  // Pembelian barang bekas di konter selalu tunai | uang keluar dari laci.
  const cashPurchases = purchases.reduce((sum, row) => sum + row.totals.total, 0)

  const expectedCash = shift.openingFloat + cashSales - cashPurchases

  return {
    shift,
    warehouseName: db().warehouses.find((row) => row.id === shift.warehouseId)?.name ?? EMPTY,
    transactionCount: rows.length,
    grossSales: sales.reduce((sum, row) => sum + row.totals.total, 0),
    tradeInValue: sales.reduce((sum, row) => sum + (row.tradeIn?.total ?? 0), 0),
    cashSales,
    nonCashSales,
    cashPurchases,
    mdrFee: rows.reduce((sum, row) => sum + row.mdrFee, 0),
    expectedCash,
    cashDifference: shift.countedCash === null ? 0 : shift.countedCash - expectedCash,
    outputVat: sales.reduce((sum, row) => sum + row.totals.ppn, 0),
  }
}

/** TODO: replace with real API call | GET /pos/shifts?from=&to= */
export function getShiftSummaries(from?: IsoDate, to?: IsoDate): Promise<PosShiftSummary[]> {
  const summaries = db()
    .posShifts.filter((shift) => (!from || shift.date >= from) && (!to || shift.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
    .map(buildShiftSummary)

  return respond(summaries)
}

/**
 * Shift yang sedang dibuka oleh kasir tertentu.
 * Satu kasir hanya boleh memegang satu laci pada satu waktu.
 */
export function findOpenShift(cashierId: string): PosShift | null {
  return (
    db().posShifts.find((shift) => shift.cashierId === cashierId && shift.status === 'open') ?? null
  )
}

/** TODO: replace with real API call | GET /pos/shifts/current */
export function getMyOpenShift(cashierId: string): Promise<PosShiftSummary | null> {
  const shift = findOpenShift(cashierId)
  return respond(shift ? buildShiftSummary(shift) : null)
}

/** TODO: replace with real API call | POST /pos/shifts */
export function openShift(
  payload: NewPosShiftPayload,
  cashier: { id: string; name: string },
  clockTime: string,
): Promise<PosShift> {
  if (findOpenShift(cashier.id)) {
    throw new ValidationError('Anda masih memegang shift yang belum ditutup.')
  }
  if (payload.openingFloat < 0) throw new ValidationError('Modal kas awal tidak boleh negatif.')

  const created = commit((database) => {
    const sequence = database.posShifts.length + 1
    const shift: PosShift = {
      id: `SHF-${String(sequence).padStart(4, '0')}`,
      number: `SHF-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      cashierId: cashier.id,
      cashierName: cashier.name,
      warehouseId: payload.warehouseId,
      date: today(),
      openedAt: clockTime,
      openingFloat: payload.openingFloat,
      closedAt: null,
      countedCash: null,
      depositedAmount: 0,
      settledAt: null,
      status: 'open',
    }
    database.posShifts.push(shift)
    return shift
  })

  return respond(created)
}

/**
 * Tutup shift: kasir menghitung uang fisik, lalu menyetor ke bank.
 *
 * Selisih hitung TIDAK boleh disembunyikan | ia langsung dijurnal ke akun 7200
 * Selisih Kas, sehingga kebocoran laci terlihat di Laba Rugi.
 *
 * TODO: replace with real API call | POST /pos/shifts/:id/close
 */
export function closeShift(payload: ClosePosShiftPayload, clockTime: string): Promise<PosShift> {
  const shift = db().posShifts.find((row) => row.id === payload.shiftId)
  if (!shift) throw new NotFoundError('Shift kasir', payload.shiftId)
  if (shift.status === 'closed') throw new ValidationError('Shift ini sudah ditutup.')

  if (payload.countedCash < 0) throw new ValidationError('Hasil hitung kas tidak boleh negatif.')
  if (payload.depositedAmount < 0) throw new ValidationError('Nilai setoran tidak boleh negatif.')
  if (payload.depositedAmount > payload.countedCash) {
    throw new ValidationError('Setoran melebihi uang yang benar-benar ada di laci.')
  }

  const updated = commit((database) => {
    const target = database.posShifts.find((row) => row.id === payload.shiftId)!
    target.countedCash = payload.countedCash
    target.depositedAmount = payload.depositedAmount
    target.closedAt = clockTime
    target.status = 'closed'
    target.notes = payload.notes
    return target
  })

  return respond(updated)
}

/* -------------------------------------------------------------------------- */
/* Transaksi kasir                                                             */
/* -------------------------------------------------------------------------- */

/** Nilai yang harus dibayar pembeli setelah dipotong tukar tambah. */
export function netDueOf(total: number, tradeInTotal: number): number {
  return total - tradeInTotal
}

function buildPosTradeIn(
  payload: NewPosTransactionPayload,
  warehouseId: string,
  invoiceTotal: number,
): TradeIn | null {
  const input = payload.tradeIn
  if (!input || input.lines.length === 0) return null

  const database = db()
  const productById = new Map(database.products.map((row) => [row.id, row]))

  for (const line of input.lines) {
    const product = productById.get(line.productId)
    if (!product) throw new NotFoundError('Produk', line.productId)
    if (product.category !== 'Barang Bekas') {
      throw new ValidationError(`${product.name} bukan barang bekas.`)
    }
    if (line.qty <= 0) throw new ValidationError(`Kuantitas ${product.name} harus lebih dari nol.`)
    if (line.unitValue <= 0) {
      throw new ValidationError(`Nilai tukar tambah ${product.name} harus lebih dari nol.`)
    }
  }

  const dpp = input.lines.reduce((sum, line) => sum + line.qty * line.unitValue, 0)
  const ppn = input.vatable ? Math.round((dpp * database.company.vatRate) / 100) : 0
  const total = dpp + ppn

  if (total > invoiceTotal) {
    throw new ValidationError(
      'Nilai tukar tambah melebihi total belanja. Kurangi nilainya atau tambah barang.',
    )
  }

  return {
    lines: input.lines.map((line) => ({
      productId: line.productId,
      qty: line.qty,
      unitValue: line.unitValue,
    })),
    warehouseId,
    dpp,
    ppn,
    total,
    taxInvoiceNumber: null,
  }
}

/**
 * Catat transaksi kasir. Langsung final | tidak ada tahap posting.
 *
 * TODO: replace with real API call | POST /pos/transactions
 */
export function createPosTransaction(
  payload: NewPosTransactionPayload,
  clockTime: string,
): Promise<PosTransaction> {
  const database = db()

  const shift = database.posShifts.find((row) => row.id === payload.shiftId)
  if (!shift) throw new NotFoundError('Shift kasir', payload.shiftId)
  if (shift.status === 'closed') {
    throw new ValidationError('Shift sudah ditutup — buka shift baru untuk bertransaksi.')
  }
  if (payload.lines.length === 0) throw new ValidationError('Keranjang masih kosong.')

  const productById = new Map(database.products.map((row) => [row.id, row]))

  for (const line of payload.lines) {
    const product = productById.get(line.productId)
    if (!product) throw new NotFoundError('Produk', line.productId)
    if (line.qty <= 0) throw new ValidationError(`Kuantitas ${product.name} harus lebih dari nol.`)

    // Konter tidak boleh menjual barang yang tidak ada di gudangnya.
    if (payload.type === 'sale') {
      const available = onHand(line.productId, shift.warehouseId)
      if (line.qty > available) {
        throw new ValidationError(
          `Stok ${product.name} tinggal ${available} ${product.unit} di gudang ini.`,
        )
      }
    } else if (product.category !== 'Barang Bekas') {
      throw new ValidationError(
        `${product.name} bukan barang bekas — pembelian konter hanya menerima barang bekas.`,
      )
    }
  }

  const lines: DocumentLine[] = payload.lines.map((line) => ({
    productId: line.productId,
    qty: line.qty,
    unitPrice: line.unitPrice,
    discountPercent: line.discountPercent,
  }))

  // Pembelian barang bekas dari pembawa scrap perorangan tidak ber-PPN:
  // mereka bukan Pengusaha Kena Pajak dan tidak menerbitkan faktur pajak.
  const totals = calcTotals(lines, payload.type === 'sale' ? database.company.vatRate : 0)

  const cogs =
    payload.type === 'sale'
      ? lines.reduce((sum, line) => sum + line.qty * (productById.get(line.productId)?.cost ?? 0), 0)
      : 0

  const tradeIn =
    payload.type === 'sale' ? buildPosTradeIn(payload, shift.warehouseId, totals.total) : null

  const netDue = netDueOf(totals.total, tradeIn?.total ?? 0)

  // Pembelian selalu tunai; metode non-tunai hanya berlaku untuk penjualan.
  const method: PosPaymentMethod = payload.type === 'buy' ? 'tunai' : payload.method

  let cashTendered = 0
  let change = 0

  if (method === 'tunai' && payload.type === 'sale') {
    cashTendered = payload.cashTendered
    if (cashTendered < netDue) {
      throw new ValidationError('Uang yang diterima kurang dari jumlah yang harus dibayar.')
    }
    change = cashTendered - netDue
  }

  const created = commit((database) => {
    const sequence = database.posTransactions.length + 1
    const prefix = payload.type === 'sale' ? 'POS' : 'PBK'

    const transaction: PosTransaction = {
      id: `${prefix}-${String(sequence).padStart(4, '0')}`,
      number: `${prefix}-${database.company.fiscalYear}-${String(sequence).padStart(4, '0')}`,
      shiftId: shift.id,
      date: today(),
      time: clockTime,
      type: payload.type,
      warehouseId: shift.warehouseId,
      customerName: payload.customerName.trim() || 'Pembeli konter',
      lines,
      totals,
      cogs,
      tradeIn,
      method,
      netDue,
      cashTendered,
      change,
      mdrFee: mdrOf(method, netDue),
      cashierId: shift.cashierId,
      cashierName: shift.cashierName,
    }

    database.posTransactions.push(transaction)
    return transaction
  })

  return respond(created)
}

/** TODO: replace with real API call | GET /pos/transactions?from=&to= */
export function getPosTransactions(from?: IsoDate, to?: IsoDate): Promise<PosTransaction[]> {
  const rows = db()
    .posTransactions.filter((row) => (!from || row.date >= from) && (!to || row.date <= to))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.number.localeCompare(a.number),
    )

  return respond(rows)
}

/** Struk beserta jurnal yang lahir darinya. */
export interface PosReceipt {
  transaction: PosTransaction
  warehouseName: string
  journal: JournalEntry[]
}

/** TODO: replace with real API call | GET /pos/transactions/:id */
export function getPosReceipt(id: string): Promise<PosReceipt> {
  const transaction = db().posTransactions.find((row) => row.id === id)
  if (!transaction) throw new NotFoundError('Transaksi kasir', id)

  return respond({
    transaction,
    warehouseName:
      db().warehouses.find((row) => row.id === transaction.warehouseId)?.name ?? EMPTY,
    journal: journalForDocument(transaction.id),
  })
}

/** Omzet kasir pada rentang tanggal | dipakai dashboard & performa. */
export function posRevenueBetween(from: IsoDate, to: IsoDate): number {
  return db()
    .posTransactions.filter((row) => row.type === 'sale' && row.date >= from && row.date <= to)
    .reduce((sum, row) => sum + row.totals.dpp, 0)
}
